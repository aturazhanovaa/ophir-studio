import enum
import uuid
import os
from datetime import datetime, timezone
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    ForeignKey,
    Text,
    UniqueConstraint,
    JSON,
    Index,
)

EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "1536"))

try:
    from pgvector.sqlalchemy import Vector  # type: ignore
except Exception:  # pragma: no cover
    Vector = None


class Base(DeclarativeBase):
    pass


def utcnow():
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    USER = "USER"
    LEGAL_ADMIN = "LEGAL_ADMIN"
    LEGAL_EDITOR = "LEGAL_EDITOR"
    LEGAL_APPROVER = "LEGAL_APPROVER"
    LEGAL_VIEWER = "LEGAL_VIEWER"


class AccessGrantSource(str, enum.Enum):
    MANUAL = "MANUAL"
    REQUEST_APPROVED = "REQUEST_APPROVED"
    SEED = "SEED"


class AccessRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class AccuracyLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class AnswerTone(str, enum.Enum):
    TECHNICAL = "TECHNICAL"
    C_EXECUTIVE = "C_EXECUTIVE"
    COLLOQUIAL = "COLLOQUIAL"
    EXECUTIVE = "C_EXECUTIVE"  # legacy alias for backward compatibility


class ContentStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    ARCHIVED = "ARCHIVED"


class TagSuggestionStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ContentSource(str, enum.Enum):
    NOTION = "NOTION"
    MANUAL = "MANUAL"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, default="", nullable=False)
    password_hash = Column(String, nullable=False)
    # kept for backward compatibility with older seeds
    is_admin = Column(Boolean, default=False, nullable=False)
    role = Column(String, default=Role.USER.value, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    memberships = relationship("AreaMembership", back_populates="user", cascade="all, delete-orphan")
    area_accesses = relationship(
        "UserAreaAccess",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="UserAreaAccess.user_id",
        primaryjoin="User.id==UserAreaAccess.user_id",
    )

    @property
    def is_super_admin(self) -> bool:
        return self.role == Role.SUPER_ADMIN.value

    @property
    def is_admin_role(self) -> bool:
        return self.role in (Role.ADMIN.value, Role.SUPER_ADMIN.value)


class Area(Base):
    __tablename__ = "areas"
    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, index=True, nullable=False)   # e.g. "marketing"
    name = Column(String, nullable=False)                           # e.g. "Marketing"
    color = Column(String, nullable=True, default="#4b5563")        # hex color accent
    created_at = Column(DateTime, default=utcnow, nullable=False)

    memberships = relationship("AreaMembership", back_populates="area", cascade="all, delete-orphan")
    accessors = relationship("UserAreaAccess", back_populates="area", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="area", cascade="all, delete-orphan")


class AreaMembership(Base):
    __tablename__ = "area_memberships"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False)

    # Granular permissions (simple + effective for MVP)
    can_read = Column(Boolean, default=True, nullable=False)
    can_write = Column(Boolean, default=False, nullable=False)
    can_manage = Column(Boolean, default=False, nullable=False)  # manage members/docs in area

    user = relationship("User", back_populates="memberships")
    area = relationship("Area", back_populates="memberships")

    __table_args__ = (UniqueConstraint("user_id", "area_id", name="uq_user_area"),)


class UserAreaAccess(Base):
    __tablename__ = "user_area_access"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False)
    granted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    source = Column(String, default=AccessGrantSource.MANUAL.value, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    user = relationship("User", back_populates="area_accesses", foreign_keys=[user_id])
    granted_by = relationship("User", foreign_keys=[granted_by_user_id])
    area = relationship("Area", back_populates="accessors")

    __table_args__ = (UniqueConstraint("user_id", "area_id", name="uq_user_area_access"),)


class AccessRequest(Base):
    __tablename__ = "access_requests"
    id = Column(Integer, primary_key=True)
    requester_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False)
    status = Column(String, default=AccessRequestStatus.PENDING.value, nullable=False)
    message = Column(Text, nullable=True)
    decided_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    decided_at = Column(DateTime, nullable=True)
    decision_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    requester = relationship("User", foreign_keys=[requester_user_id])
    decided_by = relationship("User", foreign_keys=[decided_by_user_id])
    area = relationship("Area")


class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False)

    title = Column(String, nullable=False)
    filename = Column(String, nullable=False)        # stored file name
    original_name = Column(String, nullable=False)   # original upload name
    mime_type = Column(String, default="", nullable=False)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    tags = Column(Text, default="[]", nullable=False)
    latest_version = Column(Integer, default=1, nullable=False)
    latest_version_id = Column(Integer, ForeignKey("document_versions.id"), nullable=True)

    area = relationship("Area", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")
    versions = relationship(
        "DocumentVersion",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentVersion.version.desc()",
        foreign_keys="DocumentVersion.document_id",
    )
    latest_version_ref = relationship(
        "DocumentVersion",
        primaryjoin="Document.latest_version_id==DocumentVersion.id",
        uselist=False,
        viewonly=True,
        foreign_keys="Document.latest_version_id",
    )


class DocumentVersion(Base):
    __tablename__ = "document_versions"
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    version = Column(Integer, nullable=False)
    file_path = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    mime_type = Column(String, default="", nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    document = relationship(
        "Document",
        back_populates="versions",
        foreign_keys=[document_id],
    )
    chunks = relationship("Chunk", back_populates="version", cascade="all, delete-orphan", foreign_keys="Chunk.version_id")

    __table_args__ = (UniqueConstraint("document_id", "version", name="uq_doc_version"),)


class Chunk(Base):
    __tablename__ = "chunks"
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False)
    version_id = Column(Integer, ForeignKey("document_versions.id"), nullable=True)

    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    page = Column(Integer, nullable=True)
    section = Column(String, nullable=True)

    # Vector mapping
    vector_id = Column(Integer, nullable=True)  # position inside FAISS index
    embedding = Column(
        (Vector(EMBEDDING_DIM).with_variant(JSON, "sqlite") if Vector is not None else JSON),
        nullable=True,
    )
    is_latest = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=utcnow, nullable=False)

    document = relationship("Document", back_populates="chunks", foreign_keys=[document_id])
    version = relationship("DocumentVersion", back_populates="chunks", foreign_keys=[version_id])


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"
    id = Column(Integer, primary_key=True)
    event_type = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    query = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    accuracy_level = Column(String, default=AccuracyLevel.MEDIUM.value, nullable=False)
    answer_tone = Column(String, default=AnswerTone.C_EXECUTIVE.value, nullable=False)
    tokens_in = Column(Integer, nullable=True)
    tokens_out = Column(Integer, nullable=True)
    latency_ms = Column(Integer, nullable=True)


class ConversationRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=True)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=True)
    workspace_id = Column(Integer, nullable=False, default=1)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    area = relationship("Area")
    creator = relationship("User")
    messages = relationship(
        "ConversationMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ConversationMessage.created_at",
    )


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False, index=True)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    meta = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    conversation = relationship("Conversation", back_populates="messages")


class TagCategory(Base):
    __tablename__ = "tag_categories"
    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    tags = relationship("Tag", back_populates="category", cascade="all, delete-orphan")


class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True)
    category_id = Column(Integer, ForeignKey("tag_categories.id"), nullable=False, index=True)
    key = Column(String, nullable=False, index=True)
    label = Column(String, nullable=False, index=True)
    deprecated = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    category = relationship("TagCategory", back_populates="tags")

    __table_args__ = (UniqueConstraint("category_id", "key", name="uq_tag_category_key"),)


class TagSuggestion(Base):
    __tablename__ = "tag_suggestions"
    id = Column(Integer, primary_key=True)
    category_id = Column(Integer, ForeignKey("tag_categories.id"), nullable=False)
    label = Column(String, nullable=False)
    note = Column(Text, nullable=True)
    status = Column(String, default=TagSuggestionStatus.PENDING.value, nullable=False)
    requested_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    category = relationship("TagCategory")
    requester = relationship("User")


class KnowledgeBaseArea(Base):
    __tablename__ = "kb_areas"
    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    collections = relationship("KnowledgeBaseCollection", back_populates="area", cascade="all, delete-orphan")
    content_items = relationship("ContentItem", back_populates="area", cascade="all, delete-orphan")


class KnowledgeBaseCollection(Base):
    __tablename__ = "kb_collections"
    id = Column(Integer, primary_key=True)
    area_id = Column(Integer, ForeignKey("kb_areas.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    area = relationship("KnowledgeBaseArea", back_populates="collections")
    content_items = relationship("ContentItem", back_populates="collection")


class ContentItem(Base):
    __tablename__ = "content_items"
    id = Column(Integer, primary_key=True)
    area_id = Column(Integer, ForeignKey("kb_areas.id"), nullable=False, index=True)
    collection_id = Column(Integer, ForeignKey("kb_collections.id"), nullable=True, index=True)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    summary = Column(Text, nullable=True)
    status = Column(String, default=ContentStatus.DRAFT.value, nullable=False, index=True)
    language = Column(String, default="en", nullable=False, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    owner_name = Column(String, nullable=True)
    metrics = Column(Text, nullable=True)
    archived_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    area = relationship("KnowledgeBaseArea", back_populates="content_items")
    collection = relationship("KnowledgeBaseCollection", back_populates="content_items")
    owner = relationship("User")
    tags = relationship("ContentItemTag", back_populates="content_item", cascade="all, delete-orphan")


class ContentItemTag(Base):
    __tablename__ = "content_item_tags"
    id = Column(Integer, primary_key=True)
    content_item_id = Column(Integer, ForeignKey("content_items.id"), nullable=False, index=True)
    tag_id = Column(Integer, ForeignKey("tags.id"), nullable=False, index=True)

    content_item = relationship("ContentItem", back_populates="tags")
    tag = relationship("Tag")

    __table_args__ = (UniqueConstraint("content_item_id", "tag_id", name="uq_content_item_tag"),)


class MessagingBlock(Base):
    __tablename__ = "messaging_blocks"
    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    summary = Column(Text, nullable=True)
    status = Column(String, default=ContentStatus.DRAFT.value, nullable=False, index=True)
    language = Column(String, default="en", nullable=False, index=True)
    source = Column(String, default=ContentSource.MANUAL.value, nullable=False, index=True)
    notion_page_id = Column(String, nullable=True, unique=True, index=True)
    notion_block_id = Column(String, nullable=True)
    notion_last_edited_time = Column(DateTime, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    tags = relationship("MessagingBlockTag", back_populates="messaging_block", cascade="all, delete-orphan")
    versions = relationship(
        "MessagingBlockVersion",
        back_populates="messaging_block",
        cascade="all, delete-orphan",
        order_by="MessagingBlockVersion.version.desc()",
    )


class MessagingBlockTag(Base):
    __tablename__ = "messaging_block_tags"
    id = Column(Integer, primary_key=True)
    messaging_block_id = Column(Integer, ForeignKey("messaging_blocks.id"), nullable=False, index=True)
    tag_id = Column(Integer, ForeignKey("tags.id"), nullable=False, index=True)

    messaging_block = relationship("MessagingBlock", back_populates="tags")
    tag = relationship("Tag")

    __table_args__ = (UniqueConstraint("messaging_block_id", "tag_id", name="uq_messaging_block_tag"),)


class MessagingBlockVersion(Base):
    __tablename__ = "messaging_block_versions"
    id = Column(Integer, primary_key=True)
    messaging_block_id = Column(Integer, ForeignKey("messaging_blocks.id"), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    summary = Column(Text, nullable=True)
    status = Column(String, nullable=False)
    language = Column(String, nullable=False)
    source = Column(String, nullable=False)
    tags_snapshot = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    messaging_block = relationship("MessagingBlock", back_populates="versions")

    __table_args__ = (UniqueConstraint("messaging_block_id", "version", name="uq_messaging_block_version"),)


class PlaygroundRun(Base):
    __tablename__ = "playground_runs"
    id = Column(Integer, primary_key=True)
    objective = Column(String, nullable=False)
    context = Column(Text, nullable=True)
    filters = Column(JSON, nullable=True)
    output = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)
    rating = Column(String, nullable=True)
    comment = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    user = relationship("User")


class LegalDocumentStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    IN_REVIEW = "IN_REVIEW"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"
    APPROVED = "APPROVED"
    SIGNED = "SIGNED"
    ARCHIVED = "ARCHIVED"
    REJECTED = "REJECTED"


class LegalApprovalDecision(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"


class LegalDocument(Base):
    __tablename__ = "legal_documents"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False, index=True)
    counterparty_name = Column(String, nullable=True, index=True)
    counterparty_email = Column(String, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String, default=LegalDocumentStatus.DRAFT.value, nullable=False, index=True)

    content = Column(Text, default="", nullable=False)
    variables = Column(JSON, nullable=True)

    due_date = Column(DateTime, nullable=True, index=True)
    expiry_date = Column(DateTime, nullable=True, index=True)

    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    owner = relationship("User")
    versions = relationship("LegalVersion", back_populates="document", cascade="all, delete-orphan", order_by="LegalVersion.version_number.desc()")
    approvals = relationship("LegalApproval", back_populates="document", cascade="all, delete-orphan", order_by="LegalApproval.step_number.asc()")
    audit_logs = relationship("LegalAuditLog", back_populates="document", cascade="all, delete-orphan", order_by="LegalAuditLog.created_at.desc()")


class LegalTemplate(Base):
    __tablename__ = "legal_templates"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, index=True)
    type = Column(String, nullable=False, index=True)
    body = Column(Text, default="", nullable=False)
    variables = Column(JSON, nullable=True)
    default_approvers = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class LegalVersion(Base):
    __tablename__ = "legal_versions"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("legal_documents.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    content = Column(Text, default="", nullable=False)
    variables = Column(JSON, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    document = relationship("LegalDocument", back_populates="versions")
    creator = relationship("User")

    __table_args__ = (UniqueConstraint("document_id", "version_number", name="uq_legal_doc_version"),)


class LegalApproval(Base):
    __tablename__ = "legal_approvals"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("legal_documents.id"), nullable=False, index=True)
    step_number = Column(Integer, nullable=False)
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    decision = Column(String, default=LegalApprovalDecision.PENDING.value, nullable=False, index=True)
    comment = Column(Text, nullable=True)
    decided_at = Column(DateTime, nullable=True)

    document = relationship("LegalDocument", back_populates="approvals")
    approver = relationship("User")

    __table_args__ = (UniqueConstraint("document_id", "step_number", "approver_id", name="uq_legal_approval_step"),)


class LegalAuditLog(Base):
    __tablename__ = "legal_audit_logs"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("legal_documents.id"), nullable=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String, nullable=False, index=True)
    meta = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)

    document = relationship("LegalDocument", back_populates="audit_logs")
    actor = relationship("User")


Index("idx_legal_documents_updated", LegalDocument.updated_at)
Index("idx_legal_documents_status_updated", LegalDocument.status, LegalDocument.updated_at)


class LegalExampleStatus(str, enum.Enum):
    UPLOADED = "UPLOADED"
    EXTRACTING = "EXTRACTING"
    READY = "READY"
    FAILED = "FAILED"


class LegalExampleScope(str, enum.Enum):
    GLOBAL = "GLOBAL"
    TEMPLATE = "TEMPLATE"
    CLIENT = "CLIENT"


class LegalExample(Base):
    __tablename__ = "legal_examples"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False, index=True)
    document_type = Column(String, nullable=False, index=True)
    template_id = Column(Integer, ForeignKey("legal_templates.id"), nullable=True, index=True)

    scope = Column(String, default=LegalExampleScope.GLOBAL.value, nullable=False, index=True)
    client_name = Column(String, nullable=True, index=True)

    file_name = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    storage_path = Column(String, nullable=False)

    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    uploaded_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    extracted_text = Column(Text, nullable=True)
    status = Column(String, default=LegalExampleStatus.UPLOADED.value, nullable=False, index=True)
    error_message = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True)

    uploader = relationship("User")
    template = relationship("LegalTemplate")


Index("idx_legal_examples_status_updated", LegalExample.status, LegalExample.updated_at)

Index("idx_content_items_area_status", ContentItem.area_id, ContentItem.status)
Index("idx_content_items_updated", ContentItem.updated_at)
Index("idx_messaging_blocks_status", MessagingBlock.status)
Index("idx_messaging_blocks_updated", MessagingBlock.updated_at)
