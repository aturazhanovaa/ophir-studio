export const LEGAL_VIEW_ROLES = new Set([
    "USER",
    "LEGAL_VIEWER",
    "LEGAL_EDITOR",
    "LEGAL_APPROVER",
    "LEGAL_ADMIN",
    "ADMIN",
    "SUPER_ADMIN",
]);
export const LEGAL_EDIT_ROLES = new Set(["LEGAL_EDITOR", "LEGAL_ADMIN", "ADMIN", "SUPER_ADMIN"]);
export const LEGAL_APPROVE_ROLES = new Set(["LEGAL_APPROVER", "LEGAL_ADMIN", "ADMIN", "SUPER_ADMIN"]);
export const LEGAL_TEMPLATE_ADMIN_ROLES = new Set(["LEGAL_ADMIN", "SUPER_ADMIN"]);
export function canViewLegal(user) {
    return !!user?.role && LEGAL_VIEW_ROLES.has(user.role);
}
export function canEditLegal(user) {
    return !!user?.role && LEGAL_EDIT_ROLES.has(user.role);
}
export function canApproveLegal(user) {
    return !!user?.role && LEGAL_APPROVE_ROLES.has(user.role);
}
export function canManageLegalTemplates(user) {
    return !!user?.role && LEGAL_TEMPLATE_ADMIN_ROLES.has(user.role);
}
