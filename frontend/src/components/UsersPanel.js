import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useTranslation } from "react-i18next";
export default function UsersPanel({ onToast, refreshMyAccess, }) {
    const { t: tDash } = useTranslation("dashboard");
    const { t: tCommon } = useTranslation("common");
    const [users, setUsers] = useState([]);
    const [areas, setAreas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [createForm, setCreateForm] = useState({ email: "", full_name: "", password: "", role: "USER", area_ids: [] });
    const [editingUser, setEditingUser] = useState(null);
    const [manageSelection, setManageSelection] = useState([]);
    const [savingManage, setSavingManage] = useState(false);
    const [savingCreate, setSavingCreate] = useState(false);
    const loadAreas = async () => {
        try {
            const res = (await api.listAllAreas());
            setAreas(res);
        }
        catch {
            // ignore
        }
    };
    const loadUsers = async () => {
        setLoading(true);
        try {
            const res = (await api.adminListUsers());
            setUsers(res);
        }
        catch (e) {
            onToast(e.message || tDash("usersPanel.errors.failedToLoadUsers"), "danger");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadAreas();
        loadUsers();
    }, []);
    const filteredUsers = useMemo(() => {
        if (!search.trim())
            return users;
        const term = search.toLowerCase();
        return users.filter((u) => u.email.toLowerCase().includes(term) || u.full_name.toLowerCase().includes(term));
    }, [users, search]);
    const openManage = (user) => {
        setEditingUser(user);
        setManageSelection(user.areas.map((a) => a.area_id));
    };
    const saveManage = async () => {
        if (!editingUser)
            return;
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
        }
        catch (e) {
            onToast(e.message || tDash("usersPanel.errors.failedToUpdateAccess"), "danger");
        }
        finally {
            setSavingManage(false);
        }
    };
    const createUser = async (e) => {
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
        }
        catch (e) {
            onToast(e.message || tDash("usersPanel.errors.failedToCreateUser"), "danger");
        }
        finally {
            setSavingCreate(false);
        }
    };
    return (_jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("usersPanel.eyebrow") }), _jsx("div", { className: "h2", children: tDash("usersPanel.title") }), _jsx("div", { className: "muted", children: tDash("usersPanel.subtitle") })] }) }), _jsx("div", { className: "cardSubsection", style: { marginBottom: 12 }, children: _jsx("input", { className: "input", placeholder: tDash("usersPanel.searchPlaceholder"), style: { maxWidth: 280 }, value: search, onChange: (e) => setSearch(e.target.value) }) }), _jsxs("div", { className: "cardSubsection", children: [_jsx("div", { className: "h3", children: tDash("usersPanel.create.title") }), _jsxs("form", { className: "formGrid", onSubmit: createUser, children: [_jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tDash("usersPanel.create.fullName") }), _jsx("input", { className: "input", value: createForm.full_name, onChange: (e) => setCreateForm({ ...createForm, full_name: e.target.value }) })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tDash("usersPanel.create.email") }), _jsx("input", { className: "input", value: createForm.email, onChange: (e) => setCreateForm({ ...createForm, email: e.target.value }) })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tDash("usersPanel.create.password") }), _jsx("input", { type: "password", className: "input", value: createForm.password, onChange: (e) => setCreateForm({ ...createForm, password: e.target.value }) })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tDash("usersPanel.create.role") }), _jsxs("select", { className: "input select", value: createForm.role, onChange: (e) => setCreateForm({ ...createForm, role: e.target.value }), children: [_jsx("option", { value: "USER", children: "USER" }), _jsx("option", { value: "ADMIN", children: "ADMIN" }), _jsx("option", { value: "SUPER_ADMIN", children: "SUPER_ADMIN" })] })] }), _jsxs("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { className: "fieldLabel", children: tDash("usersPanel.create.initialAreas") }), _jsx("div", { className: "checkGrid", children: areas.map((a) => (_jsxs("label", { className: "checkRow", children: [_jsx("input", { type: "checkbox", checked: createForm.area_ids.includes(a.id), onChange: (e) => {
                                                        if (e.target.checked)
                                                            setCreateForm({ ...createForm, area_ids: [...createForm.area_ids, a.id] });
                                                        else
                                                            setCreateForm({ ...createForm, area_ids: createForm.area_ids.filter((id) => id !== a.id) });
                                                    } }), _jsx("span", { children: a.name }), _jsx("span", { className: "muted", children: a.key })] }, a.id))) })] }), _jsx("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: _jsx("button", { className: "btn btnPrimary", type: "submit", disabled: savingCreate, children: savingCreate ? tDash("usersPanel.create.creating") : tDash("usersPanel.create.submit") }) })] })] }), loading && _jsx("div", { className: "muted", children: tDash("usersPanel.loadingUsers") }), !loading && filteredUsers.length === 0 && (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("usersPanel.empty.title") }), _jsx("div", { className: "emptyText", children: tDash("usersPanel.empty.text") })] })), !loading && filteredUsers.length > 0 && (_jsxs("div", { className: "table", children: [_jsxs("div", { className: "tableHead", children: [_jsx("div", { children: tDash("usersPanel.table.user") }), _jsx("div", { children: tDash("usersPanel.table.role") }), _jsx("div", { children: tDash("usersPanel.table.areas") }), _jsx("div", { children: tDash("usersPanel.table.actions") })] }), _jsx("div", { className: "tableBody", children: filteredUsers.map((u) => (_jsxs("div", { className: "tableRow", children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 700 }, children: u.full_name || u.email }), _jsx("div", { className: "muted", children: u.email })] }), _jsx("div", { children: _jsx("span", { className: "pill subtle", children: u.role }) }), _jsxs("div", { className: "tagRow", children: [u.areas.length === 0 && _jsx("span", { className: "muted", children: tDash("usersPanel.table.noAreas") }), u.areas.map((a) => (_jsx("span", { className: "pill", children: a.area_name }, a.id)))] }), _jsx("div", { className: "row", children: _jsx("button", { className: "btn", onClick: () => openManage(u), children: tDash("usersPanel.table.assignAreas") }) })] }, u.id))) })] })), editingUser && (_jsxs("div", { className: "inlinePanel", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "h3", children: tDash("usersPanel.manage.title") }), _jsx("div", { className: "muted", children: editingUser.full_name || editingUser.email })] }), _jsx("span", { className: "pill subtle", children: editingUser.role })] }), _jsx("div", { className: "checkGrid", children: areas.map((a) => (_jsxs("label", { className: "checkRow", children: [_jsx("input", { type: "checkbox", checked: manageSelection.includes(a.id), onChange: (e) => {
                                        if (e.target.checked)
                                            setManageSelection([...manageSelection, a.id]);
                                        else
                                            setManageSelection(manageSelection.filter((id) => id !== a.id));
                                    } }), _jsx("span", { children: a.name }), _jsx("span", { className: "muted", children: a.key })] }, a.id))) }), _jsxs("div", { className: "row", style: { justifyContent: "flex-end" }, children: [_jsx("button", { className: "btn", onClick: () => setEditingUser(null), children: tCommon("actions.cancel") }), _jsx("button", { className: "btn btnPrimary", disabled: savingManage, onClick: saveManage, children: savingManage ? tCommon("actions.saving") : tDash("usersPanel.manage.saveAccess") })] })] }))] }));
}
