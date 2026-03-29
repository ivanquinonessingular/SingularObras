import { useState, useEffect, useRef, useCallback } from "react";
import { auth, db, storage } from "./firebase.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, updateProfile
} from "firebase/auth";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  serverTimestamp, setDoc, getDoc
} from "firebase/firestore";
import {
  ref as storageRef, uploadBytes, getDownloadURL, deleteObject
} from "firebase/storage";

/* ─── HELPERS ─── */
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().split("T")[0];
const nowISO = () => new Date().toISOString();
const fmtDate = d => { if (!d) return ""; return new Date(d+"T00:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"}); };
const fmtDT = iso => { if (!iso) return ""; const dt = new Date(iso); return dt.toLocaleDateString("es-ES",{day:"numeric",month:"short"})+" "+dt.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}); };

const Ic = ({d,size=20,color="currentColor",...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d={d}/></svg>;
const P = {
  plus:"M12 5v14M5 12h14", check:"M20 6L9 17l-5-5", back:"M15 18l-6-6 6-6",
  folder:"M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
  task:"M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  cart:"M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0",
  note:"M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  mic:"M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8",
  img:"M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21",
  bell:"M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
  user:"M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z",
  trash:"M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2",
  x:"M18 6L6 18M6 6l12 12", clock:"M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",
  cam:"M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z",
  out:"M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  chev:"M6 9l6 6 6-6",
  edit:"M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  cal:"M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  file:"M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7zM13 2v5h5",
  download:"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  plan:"M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z",
  home:"M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  team:"M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 3a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  alert:"M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
};

const COLORS = [
  {bg:"#E8853A",fg:"#fff"},{bg:"#2BAA8E",fg:"#fff"},{bg:"#3B82C4",fg:"#fff"},
  {bg:"#E85D5D",fg:"#fff"},{bg:"#8B6DC4",fg:"#fff"},{bg:"#5BAD5E",fg:"#fff"},
  {bg:"#D4A03C",fg:"#fff"},{bg:"#4AA3C4",fg:"#fff"},
];

/* ═══════ useFirestore hook — real-time collection listener ═══════ */
function useCollection(collName) {
  const [docs, setDocs] = useState([]);
  useEffect(() => {
    const q = collection(db, collName);
    const unsub = onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort client-side by createdAt descending
      items.sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });
      setDocs(items);
    }, err => console.error(collName, err));
    return unsub;
  }, [collName]);
  return docs;
}

async function addToCollection(collName, data) {
  return addDoc(collection(db, collName), { ...data, createdAt: serverTimestamp() });
}
async function updateInCollection(collName, id, data) {
  return updateDoc(doc(db, collName, id), data);
}
async function deleteFromCollection(collName, id) {
  return deleteDoc(doc(db, collName, id));
}

/* ═══════ MAIN APP ═══════ */
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState("home");
  const [selP, setSelP] = useState(null);
  const [tab, setTab] = useState("tasks");
  const [notif, setNotif] = useState(false);

  // Listen to auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Get user profile from Firestore
        const profileRef = doc(db, "users", fbUser.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setUser({ uid: fbUser.uid, email: fbUser.email, ...profileSnap.data() });
        } else {
          setUser({ uid: fbUser.uid, email: fbUser.email, name: fbUser.displayName || fbUser.email, role: "employee", color: "#E8853A" });
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Real-time collections
  const projects = useCollection("projects");
  const tasks = useCollection("tasks");
  const shoppingLists = useCollection("shoppingLists");
  const notes = useCollection("notes");
  const notifications = useCollection("notifications");
  const plans = useCollection("plans");
  const users = useCollection("users");

  if (authLoading) return <div style={S.loadWrap}><div style={S.loadIcon}>S</div><p style={{color:"#888",marginTop:10}}>Cargando...</p></div>;
  if (!user) return <Login />;

  const isA = user.role === "admin";
  const unread = notifications.filter(n => !n.read).length;
  const proj = projects.find(p => p.id === selP);
  const go = (pid, t = "tasks") => { setSelP(pid); setTab(t); setView("project"); };

  return (
    <div style={S.root}>
      <div style={S.topBar}>
        {view === "project" && proj ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <button style={S.backBtn} onClick={() => setView("home")}><Ic d={P.back} size={20} color="#333" /></button>
            <h1 style={S.topTitle}>{proj.name}</h1>
          </div>
        ) : (
          <h1 style={S.topTitle}>{view === "home" ? `Hola, ${user.name}` : "Equipo"}</h1>
        )}
        {isA && view === "home" && (
          <button style={{ ...S.iconBtn, position: "relative" }} onClick={() => setNotif(!notif)}>
            <Ic d={P.bell} size={20} color="#555" />
            {unread > 0 && <span style={S.badge}>{unread}</span>}
          </button>
        )}
      </div>

      {notif && isA && <NPanel notifications={notifications} close={() => setNotif(false)} go={go} />}

      <div style={S.content}>
        {view === "home" && <Home projects={projects} tasks={tasks} shoppingLists={shoppingLists} notes={notes} isA={isA} go={go} user={user} users={users} />}
        {view === "team" && isA && <TeamView users={users} />}
        {view === "project" && proj && <ProjView proj={proj} tasks={tasks} shoppingLists={shoppingLists} notes={notes} plans={plans} isA={isA} user={user} tab={tab} setTab={setTab} users={users} />}
      </div>

      {view !== "project" && (
        <nav style={S.tabBar}>
          <button style={{ ...S.tabItem, ...(view === "home" ? S.tabOn : {}) }} onClick={() => setView("home")}>
            <Ic d={P.home} size={22} color={view === "home" ? "#E8853A" : "#aaa"} /><span>Inicio</span>
          </button>
          {isA && <button style={{ ...S.tabItem, ...(view === "team" ? S.tabOn : {}) }} onClick={() => setView("team")}>
            <Ic d={P.team} size={22} color={view === "team" ? "#E8853A" : "#aaa"} /><span>Equipo</span>
          </button>}
          <button style={S.tabItem} onClick={() => signOut(auth)}>
            <Ic d={P.out} size={22} color="#aaa" /><span>Salir</span>
          </button>
        </nav>
      )}
    </div>
  );
}

/* ═══ LOGIN ═══ */
function Login() {
  const [mode, setMode] = useState("login"); // login or register
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("employee");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !pass) return setError("Rellena todos los campos");
    setLoading(true); setError("");
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
      setError(e.code === "auth/invalid-credential" ? "Email o contraseña incorrectos" : e.message);
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!email || !pass || !name) return setError("Rellena todos los campos");
    if (pass.length < 6) return setError("La contraseña debe tener al menos 6 caracteres");
    setLoading(true); setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
      const color = COLORS[Math.floor(Math.random() * COLORS.length)].bg;
      await setDoc(doc(db, "users", cred.user.uid), {
        name, email, role, color, createdAt: serverTimestamp()
      });
    } catch (e) {
      setError(e.code === "auth/email-already-in-use" ? "Este email ya está registrado" : e.message);
    }
    setLoading(false);
  };

  return (
    <div style={S.loginBg}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={S.loginIcon}>S</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#333", margin: "10px 0 4px" }}>Singular</h1>
        <p style={{ fontSize: 14, color: "#888", margin: 0 }}>Gestión de obras y equipos</p>
      </div>

      <div style={{ display: "flex", gap: 0, marginBottom: 20, background: "#eee", borderRadius: 14, padding: 3 }}>
        <button style={{ ...S.modeBtn, ...(mode === "login" ? S.modeBtnOn : {}) }} onClick={() => setMode("login")}>Iniciar sesión</button>
        <button style={{ ...S.modeBtn, ...(mode === "register" ? S.modeBtnOn : {}) }} onClick={() => setMode("register")}>Registrarse</button>
      </div>

      {mode === "register" && <input style={S.loginInp} placeholder="Nombre completo" value={name} onChange={e => setName(e.target.value)} />}
      <input style={S.loginInp} placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input style={S.loginInp} placeholder="Contraseña" type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => { if (e.key === "Enter") mode === "login" ? handleLogin() : handleRegister(); }} />
      {mode === "register" && <select style={S.loginInp} value={role} onChange={e => setRole(e.target.value)}><option value="employee">Empleado</option><option value="admin">Admin</option></select>}

      {error && <p style={{ color: "#E85D5D", fontSize: 13, margin: "8px 0" }}>{error}</p>}

      <button style={S.loginBtn} onClick={mode === "login" ? handleLogin : handleRegister} disabled={loading}>
        {loading ? "Cargando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
      </button>
    </div>
  );
}

/* ═══ HOME ═══ */
function Home({ projects, tasks, shoppingLists, notes, isA, go, user, users }) {
  const [showNew, setShowNew] = useState(false);
  const [f, setF] = useState({ name: "", description: "", color: "#E8853A" });

  const allT = tasks.filter(t => !t.completed);
  const myT = isA ? allT : allT.filter(t => t.assigneeId === user.uid);
  const urgTasks = myT.map(t => ({ ...t, _p: projects.find(p => p.id === t.projectId), _a: users.find(u => u.id === t.assigneeId), _type: "task", _sd: t.date || "9999" })).sort((a, b) => a._sd.localeCompare(b._sd));
  const urgLists = shoppingLists.filter(s => !(s.items?.length > 0 && s.items.every(i => i.checked))).map(s => ({ ...s, _p: projects.find(p => p.id === s.projectId), _type: "list", _sd: s.dueDate || "9999", _ck: (s.items || []).filter(i => i.checked).length })).sort((a, b) => a._sd.localeCompare(b._sd));
  const urgent = [...urgTasks.slice(0, 4), ...urgLists.slice(0, 2)].sort((a, b) => a._sd.localeCompare(b._sd)).slice(0, 5);
  const isOv = d => d && d < today(); const isTo = d => d === today();

  const active = projects.filter(p => {
    const tc = tasks.filter(t => t.projectId === p.id).length;
    const dc = tasks.filter(t => t.projectId === p.id && t.completed).length;
    return tc === 0 || dc < tc;
  });

  const createProject = async () => {
    if (!f.name.trim()) return;
    await addToCollection("projects", { name: f.name, description: f.description, color: f.color });
    setF({ name: "", description: "", color: "#E8853A" });
    setShowNew(false);
  };

  const deleteProject = async (pid) => {
    await deleteFromCollection("projects", pid);
    // Note: in production, you'd also delete related tasks/notes/etc with a Cloud Function
  };

  return (
    <div>
      {urgent.length > 0 && (
        <div style={S.urgentBox}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Ic d={P.alert} size={18} color="#E8853A" />
            <span style={{ fontWeight: 700, fontSize: 15, color: "#333" }}>Pendiente</span>
            <span style={{ fontSize: 12, color: "#999", marginLeft: "auto" }}>{urgent.length}</span>
          </div>
          {urgent.map(item => (
            <div key={item.id} style={S.urgentItem} onClick={() => go(item.projectId, item._type === "task" ? "tasks" : "shopping")}>
              <div style={{ ...S.urgentDot, background: item._type === "task" ? "#3B82C4" : "#E8853A" }}><Ic d={item._type === "task" ? P.task : P.cart} size={13} color="#fff" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item._type === "task" ? item.title : item.name}</div>
                <div style={{ fontSize: 11, color: "#999", display: "flex", gap: 8, marginTop: 2 }}>
                  {item._p && <span>{item._p.name}</span>}
                  {(item.date || item.dueDate) && <span style={{ fontWeight: 600, color: isOv(item.date || item.dueDate) ? "#E85D5D" : isTo(item.date || item.dueDate) ? "#E8853A" : "#999" }}>{isOv(item.date || item.dueDate) ? "Vencida" : isTo(item.date || item.dueDate) ? "Hoy" : fmtDate(item.date || item.dueDate)}</span>}
                </div>
              </div>
              <Ic d={P.back} size={14} color="#ccc" style={{ transform: "rotate(180deg)" }} />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "20px 0 14px" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#333", margin: 0 }}>Proyectos</h2>
        {isA && <button style={S.addBtn} onClick={() => setShowNew(!showNew)}><Ic d={P.plus} size={16} color="#fff" /></button>}
      </div>

      {showNew && isA && (
        <div style={{ ...S.formCard, marginBottom: 16 }}>
          <input style={S.inp} placeholder="Nombre del proyecto" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
          <input style={S.inp} placeholder="Descripción" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{COLORS.map((c, i) => <button key={i} onClick={() => setF({ ...f, color: c.bg })} style={{ width: 30, height: 30, borderRadius: 10, background: c.bg, border: f.color === c.bg ? "3px solid #333" : "3px solid transparent", cursor: "pointer" }} />)}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btnP} onClick={createProject}>Crear</button>
            <button style={S.btnG} onClick={() => setShowNew(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={S.projGrid}>
        {active.map((p, i) => {
          const tc = tasks.filter(t => t.projectId === p.id).length;
          const dc = tasks.filter(t => t.projectId === p.id && t.completed).length;
          const ci = COLORS.findIndex(c => c.bg === p.color);
          const color = ci >= 0 ? COLORS[ci] : COLORS[i % COLORS.length];
          const pct = tc ? Math.round((dc / tc) * 100) : 0;
          return (
            <div key={p.id} style={{ ...S.projCard, background: color.bg }} onClick={() => go(p.id)}>
              {isA && <button style={{ ...S.iconBtn, position: "absolute", top: 10, right: 10 }} onClick={e => { e.stopPropagation(); deleteProject(p.id); }}><Ic d={P.trash} size={14} color="rgba(255,255,255,.5)" /></button>}
              <div style={{ fontSize: 36, fontWeight: 900, color: "rgba(255,255,255,.2)", lineHeight: 1 }}>{pct}%</div>
              <div style={{ marginTop: "auto" }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", marginTop: 2 }}>{dc}/{tc} tareas</div>
              </div>
              {tc > 0 && <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,.2)", marginTop: 10 }}><div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, background: "rgba(255,255,255,.7)", transition: "width .4s" }} /></div>}
            </div>
          );
        })}
      </div>
      {active.length === 0 && !showNew && <div style={S.empty}><Ic d={P.folder} size={48} color="#ddd" /><p style={{ color: "#aaa", marginTop: 12 }}>Crea tu primer proyecto</p></div>}
    </div>
  );
}

/* ═══ TEAM ═══ */
function TeamView({ users }) {
  return (
    <div>
      {users.map(u => (
        <div key={u.id} style={S.listRow}>
          <div style={{ ...S.av, background: u.color || "#E8853A", width: 36, height: 36, fontSize: 14 }}>{(u.name || "?")[0]}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#333", fontSize: 14 }}>{u.name}</div>
            <div style={{ fontSize: 12, color: "#999" }}>{u.role === "admin" ? "Admin" : "Empleado"} · {u.email}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══ PROJECT VIEW ═══ */
function ProjView({ proj, tasks, shoppingLists, notes, plans, isA, user, tab, setTab, users }) {
  const tabs = [{ id: "tasks", label: "Tareas", icon: P.task }, { id: "shopping", label: "Compras", icon: P.cart }, { id: "notes", label: "Notas", icon: P.note }, { id: "plans", label: "Planos", icon: P.plan }];
  const projTasks = tasks.filter(t => t.projectId === proj.id);
  const projLists = shoppingLists.filter(s => s.projectId === proj.id);
  const projNotes = notes.filter(n => n.projectId === proj.id);
  const projPlans = plans.filter(p => p.projectId === proj.id);

  return (
    <div>
      <div style={S.pillBar}>{tabs.map(t => <button key={t.id} style={{ ...S.pill, ...(tab === t.id ? S.pillOn : {}) }} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
      {tab === "tasks" && <TasksView proj={proj} tasks={projTasks} isA={isA} user={user} users={users} />}
      {tab === "shopping" && <ShopView proj={proj} lists={projLists} isA={isA} />}
      {tab === "notes" && <NotesView proj={proj} notes={projNotes} user={user} users={users} />}
      {tab === "plans" && <PlansView proj={proj} plans={projPlans} isA={isA} />}
    </div>
  );
}

/* ═══ TASKS ═══ */
function TasksView({ proj, tasks, isA, user, users }) {
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title: "", assigneeId: "", date: today(), description: "" });
  const [ed, setEd] = useState(null); const [ef, setEf] = useState({});
  const mine = isA ? tasks : tasks.filter(t => t.assigneeId === user.uid);

  const create = async () => {
    if (!f.title.trim()) return;
    await addToCollection("tasks", { ...f, projectId: proj.id, completed: false, completedAt: null });
    setF({ title: "", assigneeId: "", date: today(), description: "" }); setShow(false);
  };
  const toggle = async (task) => {
    const c = !task.completed;
    await updateInCollection("tasks", task.id, { completed: c, completedAt: c ? nowISO() : null });
    if (c) await addToCollection("notifications", { message: `${user.name} completó "${task.title}" en ${proj.name}`, projectId: proj.id, read: false });
  };
  const saveEdit = async () => {
    if (!ef.title?.trim()) return;
    await updateInCollection("tasks", ed, ef); setEd(null);
  };

  return (
    <div>
      {isA && <button style={{ ...S.btnP, marginBottom: 14 }} onClick={() => setShow(!show)}><Ic d={P.plus} size={14} /> Nueva tarea</button>}
      {show && isA && (
        <div style={{ ...S.formCard, marginBottom: 14 }}>
          <input style={S.inp} placeholder="Título" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
          <textarea style={{ ...S.inp, minHeight: 40, resize: "vertical" }} placeholder="Descripción" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select style={{ ...S.inp, flex: 1, minWidth: 130 }} value={f.assigneeId} onChange={e => setF({ ...f, assigneeId: e.target.value })}><option value="">Asignar a...</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            <input style={{ ...S.inp, flex: 1, minWidth: 130 }} type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 8 }}><button style={S.btnP} onClick={create}>Crear</button><button style={S.btnG} onClick={() => setShow(false)}>Cancelar</button></div>
        </div>
      )}
      {mine.map(task => {
        const a = users.find(u => u.id === task.assigneeId);
        if (ed === task.id) return (
          <div key={task.id} style={{ ...S.formCard, marginBottom: 8, borderColor: "#E8853A", borderWidth: 2 }}>
            <input style={S.inp} value={ef.title || ""} onChange={e => setEf({ ...ef, title: e.target.value })} />
            <textarea style={{ ...S.inp, minHeight: 36, resize: "vertical" }} value={ef.description || ""} onChange={e => setEf({ ...ef, description: e.target.value })} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select style={{ ...S.inp, flex: 1, minWidth: 120 }} value={ef.assigneeId || ""} onChange={e => setEf({ ...ef, assigneeId: e.target.value })}><option value="">Asignar...</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
              <input style={{ ...S.inp, flex: 1, minWidth: 120 }} type="date" value={ef.date || ""} onChange={e => setEf({ ...ef, date: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8 }}><button style={S.btnP} onClick={saveEdit}>Guardar</button><button style={S.btnG} onClick={() => setEd(null)}>Cancelar</button></div>
          </div>
        );
        return (
          <div key={task.id} style={{ ...S.listRow, opacity: task.completed ? .5 : 1 }}>
            <button style={{ ...S.cb, ...(task.completed ? { background: proj.color, borderColor: proj.color } : {}) }} onClick={() => toggle(task)}>{task.completed && <Ic d={P.check} size={13} color="#fff" />}</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: "#333", fontSize: 14, textDecoration: task.completed ? "line-through" : "none" }}>{task.title}</div>
              {task.description && <div style={{ fontSize: 12, color: "#999", marginTop: 1 }}>{task.description}</div>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 5 }}>
                {task.date && <span style={{ fontSize: 11, color: task.date < today() ? "#E85D5D" : task.date === today() ? "#E8853A" : "#999" }}><Ic d={P.cal} size={11} color="currentColor" /> {task.date === today() ? "Hoy" : fmtDate(task.date)}</span>}
                {a && <span style={{ fontSize: 11, color: "#999" }}><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: a.color, marginRight: 3 }} />{a.name}</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              {isA && <button style={S.iconBtn} onClick={() => { setEd(task.id); setEf({ title: task.title, assigneeId: task.assigneeId || "", date: task.date || "", description: task.description || "" }); }}><Ic d={P.edit} size={14} color="#ccc" /></button>}
              {isA && <button style={S.iconBtn} onClick={() => deleteFromCollection("tasks", task.id)}><Ic d={P.trash} size={14} color="#ccc" /></button>}
            </div>
          </div>
        );
      })}
      {mine.length === 0 && <div style={S.empty}><Ic d={P.task} size={44} color="#ddd" /><p style={{ color: "#aaa", marginTop: 10 }}>Sin tareas</p></div>}
    </div>
  );
}

/* ═══ SHOPPING ═══ */
function ShopView({ proj, lists, isA }) {
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ name: "", dueDate: "" });
  const [act, setAct] = useState(null);
  const [item, setItem] = useState("");
  const [edL, setEdL] = useState(null); const [elf, setElf] = useState({});
  const [edI, setEdI] = useState(null); const [eif, setEif] = useState("");

  const create = async () => {
    if (!f.name.trim()) return;
    await addToCollection("shoppingLists", { name: f.name, dueDate: f.dueDate, projectId: proj.id, items: [] });
    setF({ name: "", dueDate: "" }); setShow(false);
  };
  const addItem = async (listId, list) => {
    if (!item.trim()) return;
    const newItems = [...(list.items || []), { id: uid(), text: item.trim(), checked: false }];
    await updateInCollection("shoppingLists", listId, { items: newItems });
    setItem("");
  };
  const toggleItem = async (list, itemId) => {
    const newItems = (list.items || []).map(i => i.id === itemId ? { ...i, checked: !i.checked } : i);
    await updateInCollection("shoppingLists", list.id, { items: newItems });
  };
  const removeItem = async (list, itemId) => {
    const newItems = (list.items || []).filter(i => i.id !== itemId);
    await updateInCollection("shoppingLists", list.id, { items: newItems });
  };
  const saveEditItem = async (list) => {
    if (!eif.trim()) return;
    const newItems = (list.items || []).map(i => i.id === edI ? { ...i, text: eif.trim() } : i);
    await updateInCollection("shoppingLists", list.id, { items: newItems });
    setEdI(null);
  };

  return (
    <div>
      {isA && <button style={{ ...S.btnP, marginBottom: 14 }} onClick={() => setShow(!show)}><Ic d={P.plus} size={14} /> Nueva lista</button>}
      {show && <div style={{ ...S.formCard, marginBottom: 14 }}><input style={S.inp} placeholder="Nombre" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /><div><label style={{ fontSize: 12, color: "#999" }}>Fecha límite</label><input style={S.inp} type="date" value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} /></div><div style={{ display: "flex", gap: 8 }}><button style={S.btnP} onClick={create}>Crear</button><button style={S.btnG} onClick={() => setShow(false)}>Cancelar</button></div></div>}

      {lists.map(list => {
        const ck = (list.items || []).filter(i => i.checked).length;
        const open = act === list.id;
        const ov = list.dueDate && list.dueDate < today();

        if (edL === list.id) return (
          <div key={list.id} style={{ ...S.formCard, borderColor: "#E8853A", borderWidth: 2 }}>
            <input style={S.inp} value={elf.name || ""} onChange={e => setElf({ ...elf, name: e.target.value })} />
            <div><label style={{ fontSize: 12, color: "#999" }}>Fecha límite</label><input style={S.inp} type="date" value={elf.dueDate || ""} onChange={e => setElf({ ...elf, dueDate: e.target.value })} /></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btnP} onClick={async () => { if (!elf.name?.trim()) return; await updateInCollection("shoppingLists", edL, { name: elf.name.trim(), dueDate: elf.dueDate }); setEdL(null); }}>Guardar</button>
              <button style={S.btnG} onClick={() => setEdL(null)}>Cancelar</button>
            </div>
          </div>
        );

        return (
          <div key={list.id} style={S.formCard}>
            <div style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: 8 }} onClick={() => setAct(open ? null : list.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "#333", fontSize: 14 }}>{list.name}</div>
                <div style={{ fontSize: 12, color: "#999", display: "flex", gap: 10, marginTop: 2 }}>
                  <span>{ck}/{(list.items || []).length}</span>
                  {list.dueDate && <span style={{ color: ov ? "#E85D5D" : "#999" }}>{fmtDate(list.dueDate)}{ov && " ⚠"}</span>}
                </div>
              </div>
              <Ic d={P.chev} size={16} color="#ccc" style={{ transform: open ? "rotate(180deg)" : "", transition: "transform .2s" }} />
              {isA && <button style={S.iconBtn} onClick={e => { e.stopPropagation(); setEdL(list.id); setElf({ name: list.name, dueDate: list.dueDate || "" }); }}><Ic d={P.edit} size={13} color="#ccc" /></button>}
              {isA && <button style={S.iconBtn} onClick={e => { e.stopPropagation(); deleteFromCollection("shoppingLists", list.id); }}><Ic d={P.trash} size={13} color="#ccc" /></button>}
            </div>
            {open && (
              <div style={{ marginTop: 10, borderTop: "1px solid #eee", paddingTop: 10 }}>
                {(list.items || []).map(it => {
                  if (edI === it.id) return (
                    <div key={it.id} style={{ display: "flex", gap: 6, padding: "4px 0" }}>
                      <input style={{ ...S.inp, flex: 1, borderColor: "#E8853A" }} value={eif} onChange={e => setEif(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveEditItem(list); if (e.key === "Escape") setEdI(null); }} autoFocus />
                      <button style={{ ...S.btnP, padding: "6px 12px" }} onClick={() => saveEditItem(list)}>Ok</button>
                    </div>
                  );
                  return (
                    <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                      <button style={{ ...S.cb, width: 20, height: 20, ...(it.checked ? { background: proj.color, borderColor: proj.color } : {}) }} onClick={() => toggleItem(list, it.id)}>{it.checked && <Ic d={P.check} size={11} color="#fff" />}</button>
                      <span style={{ flex: 1, fontSize: 13, color: it.checked ? "#ccc" : "#333", textDecoration: it.checked ? "line-through" : "none" }}>{it.text}</span>
                      <button style={S.iconBtn} onClick={() => { setEdI(it.id); setEif(it.text); }}><Ic d={P.edit} size={12} color="#ccc" /></button>
                      <button style={S.iconBtn} onClick={() => removeItem(list, it.id)}><Ic d={P.x} size={12} color="#ccc" /></button>
                    </div>
                  );
                })}
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <input style={{ ...S.inp, flex: 1 }} placeholder="Añadir..." value={act === list.id ? item : ""} onChange={e => setItem(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addItem(list.id, list); }} />
                  <button style={S.btnP} onClick={() => addItem(list.id, list)}><Ic d={P.plus} size={14} /></button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {lists.length === 0 && <div style={S.empty}><Ic d={P.cart} size={44} color="#ddd" /><p style={{ color: "#aaa", marginTop: 10 }}>Sin listas</p></div>}
    </div>
  );
}

/* ═══ NOTES ═══ */
function NotesView({ proj, notes, user, users }) {
  const [text, setText] = useState(""); const [cap, setCap] = useState(""); const [rec, setRec] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mR = useRef(null); const cR = useRef([]);
  const sorted = [...notes].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const uploadFile = async (file, folder) => {
    const path = `notes/${proj.id}/${folder}/${uid()}_${file.name || "file"}`;
    const sRef = storageRef(storage, path);
    await uploadBytes(sRef, file);
    const url = await getDownloadURL(sRef);
    return { url, path };
  };

  const addNote = async (type, content, nt = "") => {
    await addToCollection("notes", { projectId: proj.id, userId: user.uid, userName: user.name, type, content, noteText: nt });
    await addToCollection("notifications", { message: `${user.name} añadió ${type === "text" ? "una nota" : type === "audio" ? "nota de voz" : "una imagen"} en ${proj.name}`, projectId: proj.id, read: false });
  };

  const onImg = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url, path } = await uploadFile(file, "images");
      await addNote("image", url, cap.trim());
      setCap("");
    } catch (err) { alert("Error al subir imagen"); console.error(err); }
    setUploading(false);
    e.target.value = "";
  };

  const startRec = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(s);
      mR.current = r; cR.current = [];
      r.ondataavailable = e => { if (e.data.size > 0) cR.current.push(e.data); };
      r.onstop = async () => {
        const blob = new Blob(cR.current, { type: "audio/webm" });
        s.getTracks().forEach(t => t.stop());
        setUploading(true);
        try {
          const file = new File([blob], "audio.webm", { type: "audio/webm" });
          const { url } = await uploadFile(file, "audio");
          await addNote("audio", url);
        } catch (err) { alert("Error al subir audio"); console.error(err); }
        setUploading(false);
      };
      r.start();
      setRec(true);
    } catch { alert("Micrófono no disponible"); }
  };

  const deleteNote = async (note) => {
    // Try to delete the file from Storage if it's a URL
    if (note.type !== "text" && note.content?.startsWith("http")) {
      try {
        // Extract the storage path from the URL
        const pathMatch = note.content.match(/o\/(.+?)\?/);
        if (pathMatch) {
          const path = decodeURIComponent(pathMatch[1]);
          await deleteObject(storageRef(storage, path));
        }
      } catch {}
    }
    await deleteFromCollection("notes", note.id);
  };

  return (
    <div>
      <div style={S.formCard}>
        <textarea style={{ ...S.inp, minHeight: 40, resize: "vertical" }} placeholder="Escribe una nota..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim()) { addNote("text", text.trim()); setText(""); } } }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button style={S.btnP} onClick={() => { if (text.trim()) { addNote("text", text.trim()); setText(""); } }} disabled={!text.trim()}>Enviar</button>
          <button style={{ ...S.btnG, ...(rec ? { background: "#E85D5D", color: "#fff", borderColor: "#E85D5D" } : {}) }} onClick={rec ? () => { mR.current?.stop(); setRec(false); } : startRec} disabled={uploading}><Ic d={P.mic} size={14} />{rec ? " Parar" : " Voz"}</button>
          <div style={{ display: "flex", gap: 6, flex: 1, minWidth: 160, alignItems: "center" }}>
            <input style={{ ...S.inp, flex: 1 }} placeholder="Nota para imagen..." value={cap} onChange={e => setCap(e.target.value)} />
            <label style={{ ...S.btnG, opacity: uploading ? .5 : 1 }}><Ic d={P.cam} size={13} /> Cámara<input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onImg} disabled={uploading} /></label>
            <label style={{ ...S.btnG, opacity: uploading ? .5 : 1 }}><Ic d={P.img} size={13} /> Galería<input type="file" accept="image/*" style={{ display: "none" }} onChange={onImg} disabled={uploading} /></label>
          </div>
        </div>
        {uploading && <div style={{ fontSize: 12, color: "#E8853A", fontWeight: 600 }}>Subiendo archivo...</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {sorted.map(note => {
          const u = users.find(x => x.id === note.userId);
          return (
            <div key={note.id} style={{ ...S.formCard, padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderBottom: "1px solid #eee" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: u?.color || "#ccc" }} />
                <span style={{ fontWeight: 700, fontSize: 12, color: "#333" }}>{note.userName || "?"}</span>
                <span style={{ fontSize: 11, color: "#bbb" }}>{note.createdAt ? fmtDT(note.createdAt.toDate?.().toISOString() || "") : ""}</span>
                <button style={{ ...S.iconBtn, marginLeft: "auto" }} onClick={() => deleteNote(note)}><Ic d={P.trash} size={12} color="#ccc" /></button>
              </div>
              <div style={{ padding: "10px 14px" }}>
                {note.type === "text" && <p style={{ margin: 0, color: "#444", fontSize: 14, lineHeight: 1.6 }}>{note.content}</p>}
                {note.type === "audio" && <audio controls src={note.content} style={{ width: "100%", maxWidth: 320 }} />}
                {note.type === "image" && <div><img src={note.content} alt="" style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 12 }} />{note.noteText && <p style={{ margin: "6px 0 0", color: "#888", fontSize: 13, fontStyle: "italic" }}>{note.noteText}</p>}</div>}
              </div>
            </div>
          );
        })}
      </div>
      {sorted.length === 0 && <div style={S.empty}><Ic d={P.note} size={44} color="#ddd" /><p style={{ color: "#aaa", marginTop: 10 }}>Añade notas, voz o imágenes</p></div>}
    </div>
  );
}

/* ═══ PLANS ═══ */
function PlansView({ proj, plans, isA }) {
  const gIcon = n => { const ext = (n || "").split(".").pop().toLowerCase(); if (ext === "pdf") return { l: "PDF", c: "#E85D5D" }; if (["dwg", "dxf", "dwf"].includes(ext)) return { l: "CAD", c: "#E8853A" }; return { l: ext.toUpperCase(), c: "#8B6DC4" }; };
  const fmtSz = b => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(1) + " MB";

  const upload = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const path = `plans/${proj.id}/${uid()}_${file.name}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      await addToCollection("plans", { projectId: proj.id, name: file.name, url, path, size: file.size });
    }
    e.target.value = "";
  };

  const deletePlan = async (plan) => {
    try { await deleteObject(storageRef(storage, plan.path)); } catch {}
    await deleteFromCollection("plans", plan.id);
  };

  return (
    <div>
      {isA && <label style={{ ...S.btnP, marginBottom: 14, cursor: "pointer", display: "inline-flex" }}><Ic d={P.plus} size={14} /> Subir planos<input type="file" accept=".pdf,.dwg,.dxf,.dwf,.dws,.dgn" multiple style={{ display: "none" }} onChange={upload} /></label>}
      {plans.map(plan => {
        const fi = gIcon(plan.name);
        return (
          <div key={plan.id} style={S.listRow}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: fi.c, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 11, flexShrink: 0 }}>{fi.l}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: "#333", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plan.name}</div>
              <div style={{ fontSize: 11, color: "#bbb", marginTop: 1 }}>{fmtSz(plan.size || 0)}</div>
            </div>
            <a href={plan.url} target="_blank" rel="noopener noreferrer" style={{ ...S.btnP, padding: "7px 12px", fontSize: 12, borderRadius: 12, textDecoration: "none" }}>Abrir</a>
            {isA && <button style={S.iconBtn} onClick={() => deletePlan(plan)}><Ic d={P.trash} size={14} color="#ccc" /></button>}
          </div>
        );
      })}
      {plans.length === 0 && <div style={S.empty}><Ic d={P.plan} size={44} color="#ddd" /><p style={{ color: "#aaa", marginTop: 10 }}>Sube PDF o AutoCAD</p></div>}
    </div>
  );
}

/* ═══ NOTIF PANEL ═══ */
function NPanel({ notifications, close, go }) {
  return (
    <div style={S.nOv} onClick={close}>
      <div style={S.nPan} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: "1px solid #eee" }}>
          <span style={{ fontWeight: 800, color: "#333", fontSize: 17 }}>Notificaciones</span>
          <button style={S.iconBtn} onClick={close}><Ic d={P.x} size={18} color="#999" /></button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {notifications.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#bbb", fontSize: 13 }}>Sin notificaciones</div>}
          {notifications.slice(0, 30).map(n => (
            <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 18px", cursor: "pointer", borderBottom: "1px solid #f5f5f5", background: n.read ? "transparent" : "#FFF8F0" }} onClick={() => { if (n.projectId) go(n.projectId, "notes"); close(); }}>
              {!n.read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#E8853A", flexShrink: 0, marginTop: 5 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#444" }}>{n.message}</div>
                <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{n.createdAt ? fmtDT(n.createdAt.toDate?.().toISOString() || "") : ""}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════ STYLES ═══════ */
const S = {
  root: { display: "flex", flexDirection: "column", height: "100vh", background: "#F2F2F7", fontFamily: "-apple-system,'SF Pro Display','Helvetica Neue',sans-serif", overflow: "hidden", color: "#333" },
  loadWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#F2F2F7" },
  loadIcon: { width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg,#E8853A,#D4A03C)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 22 },
  topBar: { padding: "16px 20px 8px", background: "#F2F2F7", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 },
  topTitle: { fontSize: 26, fontWeight: 800, color: "#333", margin: 0, letterSpacing: "-0.02em" },
  backBtn: { width: 36, height: 36, borderRadius: 18, background: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.06)" },
  content: { flex: 1, overflowY: "auto", padding: "0 16px 20px", WebkitOverflowScrolling: "touch" },
  tabBar: { display: "flex", justifyContent: "space-around", alignItems: "center", height: 64, background: "#fff", borderTop: "1px solid #e8e8e8", flexShrink: 0, paddingBottom: 8 },
  tabItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", color: "#bbb", fontSize: 10, fontWeight: 600, cursor: "pointer", padding: "6px 16px" },
  tabOn: { color: "#E8853A" },
  badge: { position: "absolute", top: -3, right: -4, width: 16, height: 16, borderRadius: "50%", background: "#E85D5D", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
  urgentBox: { background: "#fff", borderRadius: 20, padding: 16, marginBottom: 8, boxShadow: "0 1px 6px rgba(0,0,0,.04)", border: "1px solid #eee" },
  urgentItem: { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 14, background: "#FAFAFA", marginBottom: 4, cursor: "pointer" },
  urgentDot: { width: 28, height: 28, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  projGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  projCard: { borderRadius: 20, padding: "18px 16px", minHeight: 140, display: "flex", flexDirection: "column", cursor: "pointer", position: "relative", transition: "all .2s", boxShadow: "0 2px 8px rgba(0,0,0,.08)" },
  formCard: { background: "#fff", borderRadius: 18, border: "1px solid #eee", padding: 14, display: "flex", flexDirection: "column", gap: 8, marginBottom: 8, boxShadow: "0 1px 4px rgba(0,0,0,.03)" },
  inp: { width: "100%", padding: "11px 14px", borderRadius: 14, background: "#F7F7F9", border: "1px solid #e8e8e8", color: "#333", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
  btnP: { display: "inline-flex", alignItems: "center", gap: 5, padding: "10px 20px", borderRadius: 14, background: "#1a1a2e", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  btnG: { display: "inline-flex", alignItems: "center", gap: 5, padding: "10px 16px", borderRadius: 14, background: "#fff", border: "1px solid #ddd", color: "#555", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  addBtn: { width: 38, height: 38, borderRadius: 14, background: "#E8853A", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(232,133,58,.3)" },
  iconBtn: { background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 8, display: "flex", alignItems: "center" },
  listRow: { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 16, background: "#fff", border: "1px solid #eee", marginBottom: 6, boxShadow: "0 1px 3px rgba(0,0,0,.02)" },
  cb: { width: 22, height: 22, borderRadius: 8, border: "2px solid #ddd", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .15s" },
  pillBar: { display: "flex", gap: 6, marginBottom: 18, overflowX: "auto", paddingBottom: 2 },
  pill: { padding: "8px 18px", borderRadius: 20, background: "#fff", border: "1px solid #e8e8e8", color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  pillOn: { background: "#1a1a2e", color: "#fff", borderColor: "#1a1a2e" },
  av: { width: 40, height: 40, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "#fff", flexShrink: 0 },
  empty: { textAlign: "center", padding: "48px 16px", display: "flex", flexDirection: "column", alignItems: "center" },
  nOv: { position: "fixed", inset: 0, background: "rgba(0,0,0,.15)", zIndex: 200 },
  nPan: { position: "absolute", top: 0, right: 0, width: 380, maxWidth: "100vw", height: "100vh", background: "#fff", boxShadow: "-4px 0 20px rgba(0,0,0,.06)", display: "flex", flexDirection: "column" },
  loginBg: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#F2F2F7", padding: 20, maxWidth: 420, margin: "0 auto" },
  loginIcon: { width: 60, height: 60, borderRadius: 20, background: "linear-gradient(135deg,#E8853A,#D4A03C)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 26, margin: "0 auto" },
  loginInp: { width: "100%", padding: "13px 16px", borderRadius: 16, background: "#fff", border: "1px solid #e8e8e8", color: "#333", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 },
  loginBtn: { width: "100%", padding: "14px", borderRadius: 16, background: "#1a1a2e", border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 },
  modeBtn: { flex: 1, padding: "8px", borderRadius: 12, border: "none", background: "transparent", color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  modeBtnOn: { background: "#fff", color: "#333", boxShadow: "0 1px 3px rgba(0,0,0,.08)" },
};
