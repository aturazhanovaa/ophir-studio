import React, { useEffect, useMemo, useState } from "react";
import { Area, api } from "../api/client";
import { useTranslation } from "react-i18next";

type AdminAreaAccess = {
  id: number;
  area_id: number;
  area_key: string;
  area_name: string;
  source: string;
  created_at: string;
};

type AdminUser = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_admin: boolean;
  created_at: string;
  areas: AdminAreaAccess[];
};

export default function UsersPanel({
  onToast,
  refreshMyAccess,
}: {
  onToast: (msg: string, tone?: "info" | "danger" | "success") => void;
  refreshMyAccess: () => void;
}) {
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [createForm, setCreateForm] = useState({ email: "", full_name: "", password: "", role: "USER", area_ids: [] as number[] });
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [manageSelection, setManageSelection] = useState<number[]>([]);
  const [savingManage, setSavingManage] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);

  const loadAreas = async () => {
    try {
      const res = (await api.listAllAreas()) as Area[];
      setAreas(res);
    } catch {
      // ignore
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = (await api.adminListUsers()) as AdminUser[];
      setUsers(res);
    } catch (e: any) {
      onToast(e.message || tDash("usersPanel.errors.failedToLoadUsers"), "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAreas();
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const term = search.toLowerCase();
    return users.filter((u) => u.email.toLowerCase().includes(term) || u.full_name.toLowerCase().includes(term));
  }, [users, search]);

  const openManage = (user: AdminUser) => {
    setEditingUser(user);
    setManageSelection(user.areas.map((a) => a.area_id));
  };

  const saveManage = async () => {
    if (!editingUser) return;
    setSavingManage(true);
    try {
      const current = new Set(editingUser.areas.map((a) => a.area_id));
      const next = new Set(manageSelection);
      const toGrant = Array.from(next).filter((id) => !current.has(id));
      const toRevoke = Array.from(current).filter((id) => !next.has(id));

      if (toGrant.length) {
        await api.adminGrantAreas(editingUser.id, toGrant);
      }
      if (toRevoke.length) {
        await api.adminRevokeAreas(editingUser.id, toRevoke);
      }
      if (toGrant.length || toRevoke.length) {
        onToast(tDash("usersPanel.toast.accessUpdated"), "success");
        refreshMyAccess();
      }
      await loadUsers();
      setEditingUser(null);
    } catch (e: any) {
      onToast(e.message || tDash("usersPanel.errors.failedToUpdateAccess"), "danger");
    } finally {
      setSavingManage(false);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.email || !createForm.password) {
      onToast(tDash("usersPanel.errors.emailAndPasswordRequired"), "danger");
      return;
    }
    setSavingCreate(true);
    try {
      await api.adminCreateUser(createForm);
      onToast(tDash("usersPanel.toast.userCreated"), "success");
      setCreateForm({ email: "", full_name: "", password: "", role: "USER", area_ids: [] });
      await loadUsers();
    } catch (e: any) {
      onToast(e.message || tDash("usersPanel.errors.failedToCreateUser"), "danger");
    } finally {
      setSavingCreate(false);
    }
  };

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="eyebrow">{tDash("usersPanel.eyebrow")}</div>
          <div className="h2">{tDash("usersPanel.title")}</div>
          <div className="muted">{tDash("usersPanel.subtitle")}</div>
        </div>
      </div>

      <div className="cardSubsection" style={{ marginBottom: 12 }}>
        <input
          className="input"
          placeholder={tDash("usersPanel.searchPlaceholder")}
          style={{ maxWidth: 280 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="cardSubsection">
        <div className="h3">{tDash("usersPanel.create.title")}</div>
        <form className="formGrid" onSubmit={createUser}>
          <div className="formGroup">
            <label className="fieldLabel">{tDash("usersPanel.create.fullName")}</label>
            <input className="input" value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} />
          </div>
          <div className="formGroup">
            <label className="fieldLabel">{tDash("usersPanel.create.email")}</label>
            <input className="input" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
          </div>
          <div className="formGroup">
            <label className="fieldLabel">{tDash("usersPanel.create.password")}</label>
            <input type="password" className="input" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
          </div>
          <div className="formGroup">
            <label className="fieldLabel">{tDash("usersPanel.create.role")}</label>
            <select className="input select" value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </select>
          </div>
          <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
            <label className="fieldLabel">{tDash("usersPanel.create.initialAreas")}</label>
            <div className="checkGrid">
              {areas.map((a) => (
                <label key={a.id} className="checkRow">
                  <input
                    type="checkbox"
                    checked={createForm.area_ids.includes(a.id)}
                    onChange={(e) => {
                      if (e.target.checked)
                        setCreateForm({ ...createForm, area_ids: [...createForm.area_ids, a.id] });
                      else setCreateForm({ ...createForm, area_ids: createForm.area_ids.filter((id) => id !== a.id) });
                    }}
                  />
                  <span>{a.name}</span>
                  <span className="muted">{a.key}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
            <button className="btn btnPrimary" type="submit" disabled={savingCreate}>
              {savingCreate ? tDash("usersPanel.create.creating") : tDash("usersPanel.create.submit")}
            </button>
          </div>
        </form>
      </div>

      {loading && <div className="muted">{tDash("usersPanel.loadingUsers")}</div>}
      {!loading && filteredUsers.length === 0 && (
        <div className="emptyState">
          <div className="emptyTitle">{tDash("usersPanel.empty.title")}</div>
          <div className="emptyText">{tDash("usersPanel.empty.text")}</div>
        </div>
      )}

      {!loading && filteredUsers.length > 0 && (
        <div className="table">
          <div className="tableHead">
            <div>{tDash("usersPanel.table.user")}</div>
            <div>{tDash("usersPanel.table.role")}</div>
            <div>{tDash("usersPanel.table.areas")}</div>
            <div>{tDash("usersPanel.table.actions")}</div>
          </div>
          <div className="tableBody">
            {filteredUsers.map((u) => (
              <div key={u.id} className="tableRow">
                <div>
                  <div style={{ fontWeight: 700 }}>{u.full_name || u.email}</div>
                  <div className="muted">{u.email}</div>
                </div>
                <div><span className="pill subtle">{u.role}</span></div>
                <div className="tagRow">
                  {u.areas.length === 0 && <span className="muted">{tDash("usersPanel.table.noAreas")}</span>}
                  {u.areas.map((a) => (
                    <span key={a.id} className="pill">{a.area_name}</span>
                  ))}
                </div>
                <div className="row">
                  <button className="btn" onClick={() => openManage(u)}>{tDash("usersPanel.table.assignAreas")}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editingUser && (
        <div className="inlinePanel">
          <div className="cardHeader">
            <div>
              <div className="h3">{tDash("usersPanel.manage.title")}</div>
              <div className="muted">{editingUser.full_name || editingUser.email}</div>
            </div>
            <span className="pill subtle">{editingUser.role}</span>
          </div>
          <div className="checkGrid">
            {areas.map((a) => (
              <label key={a.id} className="checkRow">
                <input
                  type="checkbox"
                  checked={manageSelection.includes(a.id)}
                  onChange={(e) => {
                    if (e.target.checked) setManageSelection([...manageSelection, a.id]);
                    else setManageSelection(manageSelection.filter((id) => id !== a.id));
                  }}
                />
                <span>{a.name}</span>
                <span className="muted">{a.key}</span>
              </label>
            ))}
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => setEditingUser(null)}>{tCommon("actions.cancel")}</button>
            <button className="btn btnPrimary" disabled={savingManage} onClick={saveManage}>
              {savingManage ? tCommon("actions.saving") : tDash("usersPanel.manage.saveAccess")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
