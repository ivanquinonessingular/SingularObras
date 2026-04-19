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
import { jsPDF } from "jspdf";

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

/* ═══════ ANIMATIONS (native-feel transitions) ═══════ */
const ANIM_CSS = `
  @keyframes slideInRight { from { transform: translate3d(100%,0,0); } to { transform: translate3d(0,0,0); } }
  @keyframes slideOutRight { from { transform: translate3d(0,0,0); } to { transform: translate3d(100%,0,0); } }
  @keyframes slideUp { from { transform: translate3d(0,100%,0); } to { transform: translate3d(0,0,0); } }
  @keyframes slideDown { from { transform: translate3d(0,0,0); } to { transform: translate3d(0,100%,0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
  @keyframes popIn { from { opacity: 0; transform: scale(.94) translateY(-4px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  @keyframes tabIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  .view-enter-right { animation: slideInRight .3s cubic-bezier(.32,.72,0,1); will-change: transform; }
  .view-exit-right { animation: slideOutRight .26s cubic-bezier(.32,.72,0,1) forwards; will-change: transform; }
  .sheet-in { animation: slideUp .32s cubic-bezier(.32,.72,0,1); will-change: transform; }
  .sheet-out { animation: slideDown .26s cubic-bezier(.32,.72,0,1) forwards; will-change: transform; }
  .ov-in { animation: fadeIn .22s ease; }
  .ov-out { animation: fadeOut .22s ease forwards; }
  .drawer-in { animation: slideInRight .3s cubic-bezier(.32,.72,0,1); will-change: transform; }
  .drawer-out { animation: slideOutRight .26s cubic-bezier(.32,.72,0,1) forwards; will-change: transform; }
  .pop-in { animation: popIn .22s cubic-bezier(.32,.72,0,1); }
  .tab-in { animation: tabIn .24s cubic-bezier(.32,.72,0,1); }

  button, .tappable {
    -webkit-tap-highlight-color: transparent;
    transition: transform .16s cubic-bezier(.32,.72,0,1), opacity .16s ease;
  }
  button:not(:disabled):active, .tappable:active {
    transform: scale(0.96);
    transition: transform .08s ease-out;
  }
  input, textarea, select { -webkit-tap-highlight-color: transparent; }
  /* Smoother scroll on iOS */
  * { -webkit-overflow-scrolling: touch; }
`;

/* ═══════ useFirestore hook — real-time collection listener ═══════ */
function useCollection(collName, enabled = true) {
  const [docs, setDocs] = useState([]);
  useEffect(() => {
    if (!enabled) return;
    const colRef = collection(db, collName);
    const unsub = onSnapshot(colRef, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });
      setDocs(items);
    }, err => {
      console.error("Firestore error on", collName, ":", err.message);
    });
    return unsub;
  }, [collName, enabled]);
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
  const [projAnim, setProjAnim] = useState(""); // "" | "enter" | "exit"
  const [notifAnim, setNotifAnim] = useState(""); // "" | "enter" | "exit"
  const exportRef = useRef(null);

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

  // Real-time collections — only listen when authenticated
  const loggedIn = !!user;
  const projects = useCollection("projects", loggedIn);
  const tasks = useCollection("tasks", loggedIn);
  const shoppingLists = useCollection("shoppingLists", loggedIn);
  const notes = useCollection("notes", loggedIn);
  const notifications = useCollection("notifications", loggedIn);
  const plans = useCollection("plans", loggedIn);
  const users = useCollection("users", loggedIn);

  if (authLoading) return <div style={S.loadWrap}><div style={S.loadIcon}>S</div><p style={{color:"#888",marginTop:10}}>Cargando...</p></div>;
  if (!user) return <Login />;

  const isA = user.role === "admin";
  const unread = notifications.filter(n => !n.read).length;
  const proj = projects.find(p => p.id === selP);
  const overlayOn = view === "project" || projAnim === "exit";

  const go = (pid, t = "tasks") => {
    setSelP(pid); setTab(t);
    setProjAnim("enter");
    setView("project");
    setTimeout(() => setProjAnim(""), 320);
  };
  const closeProject = () => {
    if (projAnim === "exit") return;
    setProjAnim("exit");
    setView("home");
    setTimeout(() => setProjAnim(""), 280);
  };
  const openNotif = () => { setNotif(true); setNotifAnim("enter"); setTimeout(() => setNotifAnim(""), 300); };
  const closeNotif = () => {
    if (notifAnim === "exit") return;
    setNotifAnim("exit");
    setTimeout(() => { setNotif(false); setNotifAnim(""); }, 260);
  };
  const goFromNotif = (pid, t) => { closeNotif(); setTimeout(() => go(pid, t), 220); };

  return (
    <div style={S.root}>
      <style>{ANIM_CSS}</style>

      {/* Main layer (Home / Team) */}
      <div style={S.topBar}>
        <h1 style={S.topTitle}>{view === "team" ? "Equipo" : `Hola, ${user.name}`}</h1>
        {isA && view === "home" && (
          <button style={{ ...S.iconBtn, position: "relative" }} onClick={() => notif ? closeNotif() : openNotif()}>
            <Ic d={P.bell} size={20} color="#555" />
            {unread > 0 && <span style={S.badge}>{unread}</span>}
          </button>
        )}
      </div>

      <div style={S.content}>
        {view === "home" && <Home projects={projects} tasks={tasks} shoppingLists={shoppingLists} notes={notes} isA={isA} go={go} user={user} users={users} />}
        {view === "team" && isA && <TeamView users={users} />}
      </div>

      {!overlayOn && (
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

      {/* Project overlay (slides in from right) */}
      {overlayOn && proj && (
        <div
          className={projAnim === "enter" ? "view-enter-right" : projAnim === "exit" ? "view-exit-right" : ""}
          style={S.projOverlay}
        >
          <div style={S.topBar}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <button style={S.backBtn} onClick={closeProject}><Ic d={P.back} size={20} color="#333" /></button>
              <h1 style={{ ...S.topTitle, flex: 1 }}>{proj.name}</h1>
              {isA && <button style={S.calBtn} onClick={() => exportRef.current?.()} title="Exportar PDF"><Ic d={P.download} size={16} color="#E8853A" /></button>}
            </div>
          </div>
          <div style={S.content}>
            <ProjView proj={proj} tasks={tasks} shoppingLists={shoppingLists} notes={notes} plans={plans} isA={isA} user={user} tab={tab} setTab={setTab} users={users} goBack={closeProject} exportRef={exportRef} />
          </div>
        </div>
      )}

      {/* Notifications panel (slides in from right) */}
      {notif && isA && <NPanel notifications={notifications} anim={notifAnim} close={closeNotif} go={goFromNotif} />}
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
  const [showCal, setShowCal] = useState(false);
  const [f, setF] = useState({ name: "", description: "", color: "#E8853A" });

  const allT = tasks.filter(t => !t.completed);
  const myT = isA ? allT : allT.filter(t => {
    const ids = t.assigneeIds || (t.assigneeId ? [t.assigneeId] : []);
    return ids.includes(user.uid);
  });
  const urgTasks = myT.map(t => ({ ...t, _p: projects.find(p => p.id === t.projectId), _a: users.find(u => u.id === t.assigneeId), _type: "task", _sd: t.date || "9999" })).sort((a, b) => a._sd.localeCompare(b._sd));
  const urgLists = shoppingLists.filter(s => !(s.items?.length > 0 && s.items.every(i => i.checked))).map(s => ({ ...s, _p: projects.find(p => p.id === s.projectId), _type: "list", _sd: s.dueDate || "9999", _ck: (s.items || []).filter(i => i.checked).length })).sort((a, b) => a._sd.localeCompare(b._sd));
  const urgent = [...urgTasks.slice(0, 4), ...urgLists.slice(0, 2)].sort((a, b) => a._sd.localeCompare(b._sd)).slice(0, 5);
  const isOv = d => d && d < today(); const isTo = d => d === today();

  const active = [...projects].filter(p => !p.finished).sort((a, b) => {
    // Find earliest pending task date for each project
    const aTaskDates = tasks.filter(t => t.projectId === a.id && !t.completed && t.date).map(t => t.date);
    const bTaskDates = tasks.filter(t => t.projectId === b.id && !t.completed && t.date).map(t => t.date);
    const aMin = aTaskDates.length > 0 ? aTaskDates.sort()[0] : "9999";
    const bMin = bTaskDates.length > 0 ? bTaskDates.sort()[0] : "9999";
    if (aMin !== bMin) return aMin.localeCompare(bMin);
    // If same urgency, sort by most recent creation
    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
  });

  const createProject = async () => {
    if (!f.name.trim()) return;
    await addToCollection("projects", { name: f.name, description: f.description, color: f.color });
    setF({ name: "", description: "", color: "#E8853A" });
    setShowNew(false);
  };

  return (
    <div>
      {urgent.length > 0 && (
        <div style={S.urgentBox}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Ic d={P.alert} size={18} color="#E8853A" />
            <span style={{ fontWeight: 700, fontSize: 15, color: "#333" }}>Pendiente</span>
            <button style={{ ...S.calBtn, marginLeft: "auto" }} onClick={() => setShowCal(true)}><Ic d={P.cal} size={16} color="#E8853A" /></button>
          </div>
          {urgent.map(item => (
            <div key={item.id} className="tappable" style={S.urgentItem} onClick={() => go(item.projectId, item._type === "task" ? "tasks" : "shopping")}>
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
        <div className="pop-in" style={{ ...S.formCard, marginBottom: 16 }}>
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
            <div key={p.id} className="tappable" style={{ ...S.projCard, background: color.bg }} onClick={() => go(p.id)}>
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

      {/* Calendar modal */}
      {showCal && <CalendarView tasks={tasks} projects={projects} users={users} isA={isA} user={user} go={go} onClose={() => setShowCal(false)} />}
    </div>
  );
}

/* ═══ CALENDAR VIEW ═══ */
function CalendarView({ tasks, projects, users, isA, user, go, onClose }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selDay, setSelDay] = useState(null);

  const myTasks = isA ? tasks : tasks.filter(t => {
    const ids = t.assigneeIds || (t.assigneeId ? [t.assigneeId] : []);
    return ids.includes(user.uid);
  });

  const year = month.getFullYear();
  const mo = month.getMonth();
  const daysInMonth = new Date(year, mo + 1, 0).getDate();
  const firstDow = (new Date(year, mo, 1).getDay() + 6) % 7; // Monday = 0
  const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const dayNames = ["L","M","X","J","V","S","D"];

  const prevMonth = () => setMonth(new Date(year, mo - 1, 1));
  const nextMonth = () => setMonth(new Date(year, mo + 1, 1));

  // Group tasks by date string
  const tasksByDate = {};
  myTasks.forEach(t => {
    if (t.date) {
      if (!tasksByDate[t.date]) tasksByDate[t.date] = [];
      tasksByDate[t.date].push(t);
    }
  });

  const toDateStr = (day) => `${year}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const isToday2 = (day) => toDateStr(day) === today();

  const selDateStr = selDay ? toDateStr(selDay) : null;
  const selTasks = selDateStr ? (tasksByDate[selDateStr] || []) : [];

  const getAssignees = (task) => {
    const ids = task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []);
    return ids.map(id => users.find(u => u.id === id)).filter(Boolean);
  };

  return (
    <div className="ov-in" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div className="sheet-in" style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 500, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 10px" }}>
          <button style={S.iconBtn} onClick={prevMonth}><Ic d={P.back} size={20} color="#333" /></button>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#333" }}>{monthNames[mo]} {year}</h2>
          <button style={S.iconBtn} onClick={nextMonth}><Ic d={P.back} size={20} color="#333" style={{ transform: "rotate(180deg)" }} /></button>
        </div>

        {/* Day names */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "4px 12px", gap: 0 }}>
          {dayNames.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#bbb", padding: "4px 0" }}>{d}</div>)}
        </div>

        {/* Calendar grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "0 12px 8px", gap: 2 }}>
          {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const ds = toDateStr(day);
            const dayTasks = tasksByDate[ds] || [];
            const hasPending = dayTasks.some(t => !t.completed);
            const allDone = dayTasks.length > 0 && dayTasks.every(t => t.completed);
            const isSel = selDay === day;
            const isTod = isToday2(day);
            const isPast = ds < today() && hasPending;

            return (
              <div
                key={day}
                style={{
                  textAlign: "center", padding: "6px 0", borderRadius: 12, cursor: "pointer",
                  background: isSel ? "#1a1a2e" : isTod ? "#FFF3E8" : "transparent",
                  color: isSel ? "#fff" : isTod ? "#E8853A" : "#333",
                  fontWeight: isTod || isSel ? 800 : 500, fontSize: 14,
                  transition: "all .15s", position: "relative",
                }}
                onClick={() => setSelDay(isSel ? null : day)}
              >
                {day}
                {dayTasks.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 2 }}>
                    {hasPending && <div style={{ width: 5, height: 5, borderRadius: "50%", background: isPast ? "#E85D5D" : "#E8853A" }} />}
                    {allDone && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#2BAA8E" }} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected day tasks */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 20px", borderTop: "1px solid #eee" }}>
          {selDay && (
            <div style={{ paddingTop: 12 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "#333" }}>{selDay} {monthNames[mo].slice(0, 3)}</h3>
              {selTasks.length === 0 && <p style={{ color: "#bbb", fontSize: 13 }}>Sin tareas este día</p>}
              {selTasks.map(task => {
                const proj = projects.find(p => p.id === task.projectId);
                const assignees = getAssignees(task);
                return (
                  <div key={task.id} style={{ ...S.listRow, marginBottom: 6, opacity: task.completed ? .5 : 1, cursor: "pointer" }} onClick={() => { go(task.projectId, "tasks"); onClose(); }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: task.completed ? "#2BAA8E" : "#E8853A", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#333", textDecoration: task.completed ? "line-through" : "none" }}>{task.title}</div>
                      <div style={{ fontSize: 11, color: "#999", display: "flex", gap: 8, marginTop: 2 }}>
                        {proj && <span>{proj.name}</span>}
                        {assignees.map(a => <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: a.color }} />{a.name}</span>)}
                      </div>
                    </div>
                    <Ic d={P.back} size={12} color="#ccc" style={{ transform: "rotate(180deg)" }} />
                  </div>
                );
              })}
            </div>
          )}
          {!selDay && <p style={{ color: "#bbb", fontSize: 13, textAlign: "center", paddingTop: 16 }}>Pulsa un día para ver sus tareas</p>}
        </div>

        {/* Close button */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #eee" }}>
          <button style={{ ...S.btnP, width: "100%", justifyContent: "center", borderRadius: 16 }} onClick={onClose}>Cerrar</button>
        </div>
      </div>
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
function ProjView({ proj, tasks, shoppingLists, notes, plans, isA, user, tab, setTab, users, goBack, exportRef }) {
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [exporting, setExporting] = useState(false);
  const tabs = [{ id: "tasks", label: "Tareas", icon: P.task }, { id: "shopping", label: "Compras", icon: P.cart }, { id: "notes", label: "Notas", icon: P.note }, { id: "plans", label: "Planos", icon: P.plan }];
  const projTasks = tasks.filter(t => t.projectId === proj.id);
  const projLists = shoppingLists.filter(s => s.projectId === proj.id);
  const projNotes = notes.filter(n => n.projectId === proj.id);
  const projPlans = plans.filter(p => p.projectId === proj.id);

  const finishProject = async () => {
    await updateInCollection("projects", proj.id, { finished: true, finishedAt: nowISO() });
    goBack();
  };

  // Register export function on parent ref
  useEffect(() => {
    if (exportRef) exportRef.current = exportPDF;
    return () => { if (exportRef) exportRef.current = null; };
  });

  const getAssigneeNames = (task) => {
    const ids = task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []);
    return ids.map(id => users.find(u => u.id === id)?.name || "?").join(", ");
  };

  const loadImageAsBase64 = async (url) => {
    // Method 1: Try fetch with blob URL to bypass CORS canvas tainting
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const maxW = 800, maxH = 600;
            let w = img.width, h = img.height;
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
            if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            canvas.getContext("2d").drawImage(img, 0, 0, w, h);
            const data = canvas.toDataURL("image/jpeg", 0.7);
            URL.revokeObjectURL(blobUrl);
            resolve({ data, w, h });
          } catch { URL.revokeObjectURL(blobUrl); resolve(null); }
        };
        img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null); };
        img.src = blobUrl;
      });
    } catch {
      // Method 2: Fallback - read blob directly as dataURL
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const img = new Image();
            img.onload = () => {
              const maxW = 800, maxH = 600;
              let w = img.width, h = img.height;
              if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
              if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
              resolve({ data: reader.result, w, h });
            };
            img.onerror = () => resolve(null);
            img.src = reader.result;
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch { return null; }
    }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const W = 190; // usable width
      const LM = 10; // left margin
      let y = 10;

      const checkPage = (need = 20) => { if (y + need > 280) { pdf.addPage(); y = 10; } };
      const drawLine = () => { pdf.setDrawColor(220); pdf.line(LM, y, LM + W, y); y += 4; };
      const ts = (d) => { if (!d) return ""; try { return new Date(d.seconds ? d.seconds * 1000 : d).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }); } catch { return String(d); } };

      // ─── HEADER ───
      pdf.setFillColor(232, 133, 58);
      pdf.rect(0, 0, 210, 32, "F");
      pdf.setTextColor(255);
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.text(proj.name, LM, 16);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Reporte generado el ${new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}`, LM, 24);
      if (proj.description) { pdf.text(proj.description, LM, 29); }
      y = 40;
      pdf.setTextColor(0);

      // ─── RESUMEN ───
      const totalT = projTasks.length;
      const doneT = projTasks.filter(t => t.completed).length;
      const pendT = totalT - doneT;
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("Resumen", LM, y); y += 6;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(`Tareas: ${totalT} total, ${doneT} completadas, ${pendT} pendientes`, LM, y); y += 5;
      pdf.text(`Listas de compra: ${projLists.length}`, LM, y); y += 5;
      pdf.text(`Notas: ${projNotes.length}`, LM, y); y += 5;
      pdf.text(`Planos: ${projPlans.length}`, LM, y); y += 8;
      drawLine();

      // ─── TAREAS ───
      const sortedTasks = [...projTasks].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
      if (sortedTasks.length > 0) {
        checkPage(20);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(59, 130, 196);
        pdf.text("Tareas", LM, y); y += 8;
        pdf.setTextColor(0);

        for (const task of sortedTasks) {
          checkPage(18);
          const status = task.completed ? "✓" : "○";
          const assignees = getAssigneeNames(task);

          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          pdf.text(`${status}  ${task.title}`, LM, y); y += 5;

          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(120);
          const meta = [task.date ? fmtDate(task.date) : null, assignees || null, task.completed ? "Completada" : "Pendiente"].filter(Boolean).join("  ·  ");
          pdf.text(meta, LM + 4, y); y += 4;

          if (task.description) {
            const descLines = pdf.splitTextToSize(task.description, W - 8);
            checkPage(descLines.length * 4 + 2);
            pdf.text(descLines, LM + 4, y); y += descLines.length * 4;
          }
          pdf.setTextColor(0);
          y += 3;
        }
        drawLine();
      }

      // ─── LISTAS DE COMPRA ───
      if (projLists.length > 0) {
        checkPage(20);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(232, 133, 58);
        pdf.text("Listas de compra", LM, y); y += 8;
        pdf.setTextColor(0);

        for (const list of projLists) {
          checkPage(14);
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          const ck = (list.items || []).filter(i => i.checked).length;
          pdf.text(`${list.name}  (${ck}/${(list.items || []).length})`, LM, y); y += 5;
          if (list.dueDate) { pdf.setFontSize(9); pdf.setFont("helvetica", "normal"); pdf.setTextColor(120); pdf.text(`Fecha límite: ${fmtDate(list.dueDate)}`, LM + 4, y); y += 4; pdf.setTextColor(0); }

          for (const item of (list.items || [])) {
            checkPage(6);
            pdf.setFontSize(9);
            pdf.setFont("helvetica", "normal");
            const check = item.checked ? "☑" : "☐";
            pdf.text(`  ${check}  ${item.text}`, LM + 4, y); y += 4;
          }
          y += 4;
        }
        drawLine();
      }

      // ─── NOTAS ───
      const sortedNotes = [...projNotes].sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return ta - tb;
      });

      if (sortedNotes.length > 0) {
        checkPage(20);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(139, 109, 196);
        pdf.text("Notas", LM, y); y += 8;
        pdf.setTextColor(0);

        for (const note of sortedNotes) {
          checkPage(16);
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(120);
          pdf.text(`${note.userName || "?"} — ${ts(note.createdAt)}`, LM, y); y += 5;
          pdf.setTextColor(0);

          if (note.type === "text") {
            pdf.setFontSize(10);
            const lines = pdf.splitTextToSize(note.content || "", W - 4);
            checkPage(lines.length * 4 + 4);
            pdf.text(lines, LM + 2, y); y += lines.length * 4 + 2;
          }

          if (note.type === "audio") {
            pdf.setFontSize(9);
            pdf.setTextColor(100);
            pdf.text("[Nota de voz]", LM + 2, y); y += 5;
            pdf.setTextColor(0);
          }

          if (note.type === "image" && note.content?.startsWith("http")) {
            try {
              const imgResult = await loadImageAsBase64(note.content);
              if (imgResult && imgResult.data) {
                // Scale to fit max 80mm wide, keep aspect ratio
                const maxPdfW = 80;
                const maxPdfH = 60;
                let pdfW = maxPdfW;
                let pdfH = (imgResult.h / imgResult.w) * pdfW;
                if (pdfH > maxPdfH) { pdfH = maxPdfH; pdfW = (imgResult.w / imgResult.h) * pdfH; }
                checkPage(pdfH + 10);
                pdf.addImage(imgResult.data, "JPEG", LM + 2, y, pdfW, pdfH);
                y += pdfH + 2;
              } else {
                pdf.setFontSize(9); pdf.setTextColor(150);
                pdf.text("[Imagen no disponible]", LM + 2, y); y += 5;
                pdf.setTextColor(0);
              }
            } catch { /* skip image if fails */ }
            if (note.noteText) {
              checkPage(6);
              pdf.setFontSize(9);
              pdf.setTextColor(100);
              const capLines = pdf.splitTextToSize(note.noteText, W - 8);
              pdf.text(capLines, LM + 2, y); y += capLines.length * 4;
              pdf.setTextColor(0);
            }
            y += 2;
          }
          y += 3;
        }
        drawLine();
      }

      // ─── PLANOS ───
      if (projPlans.length > 0) {
        checkPage(20);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(43, 170, 142);
        pdf.text("Planos y archivos", LM, y); y += 8;
        pdf.setTextColor(0);

        for (const plan of projPlans) {
          checkPage(8);
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          const ext = (plan.name || "").split(".").pop().toUpperCase();
          pdf.text(`• ${plan.name}  (${ext})`, LM + 2, y); y += 5;
        }
      }

      // ─── FOOTER ───
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(180);
        pdf.text(`Singular — ${proj.name} — Página ${i}/${pageCount}`, 105, 292, { align: "center" });
      }

      pdf.save(`${proj.name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, "_")}_reporte.pdf`);
    } catch (err) {
      console.error("Export error:", err);
      alert("Error al generar el PDF: " + err.message);
    }
    setExporting(false);
  };

  return (
    <div>
      <div style={S.pillBar}>{tabs.map(t => <button key={t.id} style={{ ...S.pill, ...(tab === t.id ? S.pillOn : {}) }} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
      {exporting && <div style={{ fontSize: 12, color: "#E8853A", fontWeight: 600, marginBottom: 10, textAlign: "center" }}>Generando PDF...</div>}
      <div key={tab} className="tab-in">
        {tab === "tasks" && <TasksView proj={proj} tasks={projTasks} isA={isA} user={user} users={users} />}
        {tab === "shopping" && <ShopView proj={proj} lists={projLists} isA={isA} />}
        {tab === "notes" && <NotesView proj={proj} notes={projNotes} user={user} users={users} />}
        {tab === "plans" && <PlansView proj={proj} plans={projPlans} isA={isA} />}
      </div>

      {isA && (
        <div style={{ marginTop: 30, padding: "16px 0", borderTop: "1px solid #eee" }}>
          {!confirmFinish ? (
            <button style={{ ...S.btnG, width: "100%", justifyContent: "center", color: "#999" }} onClick={() => setConfirmFinish(true)}>
              <Ic d={P.check} size={14} color="#999" /> Marcar proyecto como finalizado
            </button>
          ) : (
            <div className="pop-in" style={S.formCard}>
              <p style={{ margin: "0 0 10px", fontSize: 14, color: "#555", textAlign: "center" }}>¿Seguro que quieres finalizar <strong>{proj.name}</strong>?</p>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#999", textAlign: "center" }}>El proyecto dejará de aparecer en la página principal. Esta acción se puede revertir desde Firebase.</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button style={{ ...S.btnP, background: "#E85D5D" }} onClick={finishProject}>Sí, finalizar</button>
                <button style={S.btnG} onClick={() => setConfirmFinish(false)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══ TASKS ═══ */
function TasksView({ proj, tasks, isA, user, users }) {
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title: "", assigneeIds: [], date: today(), description: "" });
  const [ed, setEd] = useState(null); const [ef, setEf] = useState({});
  const mine = isA ? tasks : tasks.filter(t => {
    const ids = t.assigneeIds || (t.assigneeId ? [t.assigneeId] : []);
    return ids.includes(user.uid);
  });

  const toggleAssignee = (uid, current) => {
    return current.includes(uid) ? current.filter(id => id !== uid) : [...current, uid];
  };

  const create = async () => {
    if (!f.title.trim()) return;
    await addToCollection("tasks", { title: f.title, description: f.description, date: f.date, assigneeIds: f.assigneeIds, projectId: proj.id, completed: false, completedAt: null });
    setF({ title: "", assigneeIds: [], date: today(), description: "" }); setShow(false);
  };
  const toggle = async (task) => {
    const c = !task.completed;
    await updateInCollection("tasks", task.id, { completed: c, completedAt: c ? nowISO() : null });
    if (c) await addToCollection("notifications", { message: `${user.name} completó "${task.title}" en ${proj.name}`, projectId: proj.id, read: false });
  };
  const saveEdit = async () => {
    if (!ef.title?.trim()) return;
    await updateInCollection("tasks", ed, { title: ef.title, description: ef.description, date: ef.date, assigneeIds: ef.assigneeIds || [] }); setEd(null);
  };

  const getAssignees = (task) => {
    const ids = task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []);
    return ids.map(id => users.find(u => u.id === id)).filter(Boolean);
  };

  return (
    <div>
      {isA && <button style={{ ...S.btnP, marginBottom: 14 }} onClick={() => setShow(!show)}><Ic d={P.plus} size={14} /> Nueva tarea</button>}
      {show && isA && (
        <div className="pop-in" style={{ ...S.formCard, marginBottom: 14 }}>
          <input style={S.inp} placeholder="Título" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
          <textarea style={{ ...S.inp, minHeight: 40, resize: "vertical" }} placeholder="Descripción" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
          <div><label style={{ fontSize: 12, color: "#999", fontWeight: 600 }}>Asignar a:</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {users.map(u => {
                const sel = f.assigneeIds.includes(u.id);
                return <button key={u.id} type="button" style={{ ...S.chipBtn, ...(sel ? { background: u.color || "#E8853A", color: "#fff", borderColor: u.color || "#E8853A" } : {}) }} onClick={() => setF({ ...f, assigneeIds: toggleAssignee(u.id, f.assigneeIds) })}>{u.name}</button>;
              })}
            </div>
          </div>
          <input style={S.inp} type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
          <div style={{ display: "flex", gap: 8 }}><button style={S.btnP} onClick={create}>Crear</button><button style={S.btnG} onClick={() => setShow(false)}>Cancelar</button></div>
        </div>
      )}
      {mine.map(task => {
        const assignees = getAssignees(task);
        if (ed === task.id) return (
          <div key={task.id} className="pop-in" style={{ ...S.formCard, marginBottom: 8, borderColor: "#E8853A", borderWidth: 2 }}>
            <input style={S.inp} value={ef.title || ""} onChange={e => setEf({ ...ef, title: e.target.value })} />
            <textarea style={{ ...S.inp, minHeight: 36, resize: "vertical" }} value={ef.description || ""} onChange={e => setEf({ ...ef, description: e.target.value })} />
            <div><label style={{ fontSize: 12, color: "#999", fontWeight: 600 }}>Asignar a:</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {users.map(u => {
                  const sel = (ef.assigneeIds || []).includes(u.id);
                  return <button key={u.id} type="button" style={{ ...S.chipBtn, ...(sel ? { background: u.color || "#E8853A", color: "#fff", borderColor: u.color || "#E8853A" } : {}) }} onClick={() => setEf({ ...ef, assigneeIds: toggleAssignee(u.id, ef.assigneeIds || []) })}>{u.name}</button>;
                })}
              </div>
            </div>
            <input style={S.inp} type="date" value={ef.date || ""} onChange={e => setEf({ ...ef, date: e.target.value })} />
            <div style={{ display: "flex", gap: 8 }}><button style={S.btnP} onClick={saveEdit}>Guardar</button><button style={S.btnG} onClick={() => setEd(null)}>Cancelar</button></div>
          </div>
        );
        return (
          <div key={task.id} style={{ ...S.listRow, opacity: task.completed ? .5 : 1 }}>
            <button style={{ ...S.cb, ...(task.completed ? { background: proj.color, borderColor: proj.color } : {}) }} onClick={() => toggle(task)}>{task.completed && <Ic d={P.check} size={13} color="#fff" />}</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: "#333", fontSize: 14, textDecoration: task.completed ? "line-through" : "none" }}>{task.title}</div>
              {task.description && <div style={{ fontSize: 12, color: "#999", marginTop: 1 }}>{task.description}</div>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 5 }}>
                {task.date && <span style={{ fontSize: 11, color: task.date < today() ? "#E85D5D" : task.date === today() ? "#E8853A" : "#999" }}><Ic d={P.cal} size={11} color="currentColor" /> {task.date === today() ? "Hoy" : fmtDate(task.date)}</span>}
                {assignees.map(a => <span key={a.id} style={{ fontSize: 11, color: "#999" }}><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: a.color, marginRight: 3 }} />{a.name}</span>)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              {isA && <button style={S.iconBtn} onClick={() => { setEd(task.id); setEf({ title: task.title, assigneeIds: task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []), date: task.date || "", description: task.description || "" }); }}><Ic d={P.edit} size={14} color="#ccc" /></button>}
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
      {show && <div className="pop-in" style={{ ...S.formCard, marginBottom: 14 }}><input style={S.inp} placeholder="Nombre" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /><div><label style={{ fontSize: 12, color: "#999" }}>Fecha límite</label><input style={S.inp} type="date" value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} /></div><div style={{ display: "flex", gap: 8 }}><button style={S.btnP} onClick={create}>Crear</button><button style={S.btnG} onClick={() => setShow(false)}>Cancelar</button></div></div>}

      {lists.map(list => {
        const ck = (list.items || []).filter(i => i.checked).length;
        const open = act === list.id;
        const ov = list.dueDate && list.dueDate < today();

        if (edL === list.id) return (
          <div key={list.id} className="pop-in" style={{ ...S.formCard, borderColor: "#E8853A", borderWidth: 2 }}>
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
  const [text, setText] = useState(""); const [rec, setRec] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mR = useRef(null); const cR = useRef([]);
  const camRef = useRef(null);
  const galRef = useRef(null);
  const sorted = [...notes].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const uploadFile = async (file, folder) => {
    const path = `notes/${proj.id}/${folder}/${uid()}_${file.name || "file"}`;
    const sRef = storageRef(storage, path);
    await uploadBytes(sRef, file);
    const url = await getDownloadURL(sRef);
    return { url, path };
  };

  // Compress image to max 1600px and JPEG quality 0.7 to stay under Firebase limits
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const maxSize = 1600;
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name || "photo.jpg", { type: "image/jpeg" }));
        }, "image/jpeg", 0.7);
      };
      img.onerror = () => resolve(file); // fallback to original if compression fails
      img.src = URL.createObjectURL(file);
    });
  };

  const addNote = async (type, content, nt = "") => {
    await addToCollection("notes", { projectId: proj.id, userId: user.uid, userName: user.name, type, content, noteText: nt });
    await addToCollection("notifications", { message: `${user.name} añadió ${type === "text" ? "una nota" : type === "audio" ? "nota de voz" : "una imagen"} en ${proj.name}`, projectId: proj.id, read: false });
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Compress image before uploading
      const compressed = await compressImage(file);
      console.log("Original:", (file.size/1024/1024).toFixed(1)+"MB", "→ Compressed:", (compressed.size/1024/1024).toFixed(1)+"MB");
      const { url } = await uploadFile(compressed, "images");
      await addNote("image", url);
    } catch (err) { alert("Error al subir imagen: " + err.message); console.error("Upload error:", err); }
    setUploading(false);
    e.target.value = "";
  };

  const startRec = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Use mp4 for Safari compatibility, fallback to webm
      const mimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : 
                       MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : 
                       "audio/webm";
      const ext = mimeType.includes("mp4") ? "m4a" : "webm";
      const r = new MediaRecorder(s, { mimeType });
      mR.current = r; cR.current = [];
      r.ondataavailable = e => { if (e.data.size > 0) cR.current.push(e.data); };
      r.onstop = async () => {
        const blob = new Blob(cR.current, { type: mimeType });
        s.getTracks().forEach(t => t.stop());
        setUploading(true);
        try {
          const file = new File([blob], `audio.${ext}`, { type: mimeType });
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
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFile} />
            <input ref={galRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
            <button style={{ ...S.btnG, opacity: uploading ? .5 : 1 }} onClick={() => { if (!uploading && camRef.current) { camRef.current.value = ""; camRef.current.click(); }}} disabled={uploading}><Ic d={P.cam} size={13} /> Cámara</button>
            <button style={{ ...S.btnG, opacity: uploading ? .5 : 1 }} onClick={() => { if (!uploading && galRef.current) { galRef.current.value = ""; galRef.current.click(); }}} disabled={uploading}><Ic d={P.img} size={13} /> Galería</button>
          </div>
        </div>
        {uploading && <div style={{ fontSize: 12, color: "#E8853A", fontWeight: 600 }}>Subiendo archivo...</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {sorted.map(note => {
          const u = users.find(x => x.id === note.userId);
          return (
            <NoteCard key={note.id} note={note} user={u} onDelete={() => deleteNote(note)} />
          );
        })}
      </div>
      {sorted.length === 0 && <div style={S.empty}><Ic d={P.note} size={44} color="#ddd" /><p style={{ color: "#aaa", marginTop: 10 }}>Añade notas, voz o imágenes</p></div>}
    </div>
  );
}

/* ═══ ZOOMABLE IMAGE (pinch, pan, double-tap) ═══ */
function ZoomableImage({ src }) {
  const [t, setT] = useState({ scale: 1, x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const tRef = useRef(t);
  const touch = useRef(null);
  const lastTap = useRef(0);
  const imgRef = useRef(null);
  const update = (nt) => { tRef.current = nt; setT(nt); };

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const dist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
    const center = (ts) => ({ x: (ts[0].clientX + ts[1].clientX) / 2, y: (ts[0].clientY + ts[1].clientY) / 2 });

    const onStart = (e) => {
      const s = tRef.current;
      if (e.touches.length === 2) {
        e.preventDefault();
        touch.current = { type: "pinch", d: dist(e.touches), c: center(e.touches), ss: s.scale, sx: s.x, sy: s.y };
        setActive(true);
      } else if (e.touches.length === 1) {
        touch.current = { type: "tap", sx: e.touches[0].clientX, sy: e.touches[0].clientY, ix: s.x, iy: s.y };
      }
    };
    const onMove = (e) => {
      const ts = touch.current;
      if (!ts) return;
      if (ts.type === "pinch" && e.touches.length === 2) {
        e.preventDefault();
        const d = dist(e.touches), c = center(e.touches);
        const ns = Math.min(4, Math.max(1, ts.ss * (d / ts.d)));
        update({ scale: ns, x: ts.sx + (c.x - ts.c.x), y: ts.sy + (c.y - ts.c.y) });
      } else if (e.touches.length === 1 && (ts.type === "tap" || ts.type === "pan")) {
        const dx = e.touches[0].clientX - ts.sx;
        const dy = e.touches[0].clientY - ts.sy;
        if (ts.type === "tap") {
          if (Math.hypot(dx, dy) > 10) {
            if (tRef.current.scale > 1) { ts.type = "pan"; setActive(true); }
            else { touch.current = null; return; }
          } else return;
        }
        e.preventDefault();
        update({ scale: tRef.current.scale, x: ts.ix + dx, y: ts.iy + dy });
      }
    };
    const onEnd = () => {
      const ts = touch.current;
      if (!ts) return;
      touch.current = null;
      setActive(false);
      if (ts.type === "tap") {
        const now = Date.now();
        const dt = now - lastTap.current;
        if (dt > 0 && dt < 300) {
          if (tRef.current.scale > 1.05) update({ scale: 1, x: 0, y: 0 });
          else update({ scale: 2.5, x: 0, y: 0 });
          lastTap.current = 0;
        } else lastTap.current = now;
      } else {
        lastTap.current = 0;
        if (tRef.current.scale < 1.05) update({ scale: 1, x: 0, y: 0 });
      }
    };

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: false });
    el.addEventListener("touchcancel", onEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return (
    <img
      ref={imgRef}
      src={src}
      alt=""
      onClick={(e) => e.stopPropagation()}
      draggable={false}
      style={{
        transform: `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.scale})`,
        transition: active ? "none" : "transform .28s cubic-bezier(.32,.72,0,1)",
        transformOrigin: "center center",
        touchAction: "none",
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit: "contain",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        willChange: "transform",
      }}
    />
  );
}

/* ═══ NOTE CARD (with editable comment for images) ═══ */
function NoteCard({ note, user, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState(note.noteText || "");
  const [fullscreen, setFullscreen] = useState(false);

  const saveComment = async () => {
    await updateInCollection("notes", note.id, { noteText: comment.trim() });
    setEditing(false);
  };

  return (
    <div style={{ ...S.formCard, padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderBottom: "1px solid #eee" }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: user?.color || "#ccc" }} />
        <span style={{ fontWeight: 700, fontSize: 12, color: "#333" }}>{note.userName || "?"}</span>
        <span style={{ fontSize: 11, color: "#bbb" }}>{note.createdAt ? fmtDT(note.createdAt.toDate?.().toISOString() || "") : ""}</span>
        <button style={{ ...S.iconBtn, marginLeft: "auto" }} onClick={onDelete}><Ic d={P.trash} size={12} color="#ccc" /></button>
      </div>
      <div style={{ padding: "10px 14px" }}>
        {note.type === "text" && <p style={{ margin: 0, color: "#444", fontSize: 14, lineHeight: 1.6 }}>{note.content}</p>}
        {note.type === "audio" && <audio controls src={note.content} style={{ width: "100%", maxWidth: 320 }} />}
        {note.type === "image" && (
          <div>
            <img
              src={note.content} alt=""
              style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 12, cursor: "pointer" }}
              onClick={() => setFullscreen(true)}
            />
            {editing ? (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input
                  style={{ ...S.inp, flex: 1, borderColor: "#E8853A" }}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveComment(); if (e.key === "Escape") setEditing(false); }}
                  placeholder="Escribe un comentario..."
                  autoFocus
                />
                <button style={{ ...S.btnP, padding: "6px 14px" }} onClick={saveComment}>Ok</button>
                <button style={S.iconBtn} onClick={() => { setComment(note.noteText || ""); setEditing(false); }}><Ic d={P.x} size={14} color="#ccc" /></button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 6 }}>
                {note.noteText ? (
                  <p style={{ margin: 0, color: "#555", fontSize: 13, fontStyle: "italic", flex: 1 }}>{note.noteText}</p>
                ) : (
                  <span style={{ color: "#bbb", fontSize: 12, flex: 1 }}>Sin comentario</span>
                )}
                <button style={S.iconBtn} onClick={() => { setComment(note.noteText || ""); setEditing(true); }}>
                  <Ic d={P.edit} size={13} color="#ccc" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen image viewer */}
      {fullscreen && (
        <div
          className="ov-in"
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,.92)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setFullscreen(false)}
        >
          <button
            aria-label="Cerrar"
            style={{
              position: "absolute",
              top: "max(14px, env(safe-area-inset-top, 0px))",
              right: 14,
              width: 44, height: 44, borderRadius: 22,
              background: "rgba(0,0,0,.55)",
              border: "1.5px solid rgba(255,255,255,.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", zIndex: 10001,
              padding: 0, touchAction: "manipulation",
            }}
            onClick={(e) => { e.stopPropagation(); setFullscreen(false); }}
          >
            <Ic d={P.x} size={22} color="#fff" />
          </button>
          <div
            style={{
              width: "100%", height: "100%",
              overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 16,
            }}
          >
            <ZoomableImage src={note.content} />
          </div>
          {note.noteText && (
            <div style={{
              position: "absolute",
              bottom: "max(20px, env(safe-area-inset-bottom, 0px))",
              left: 20, right: 20,
              background: "rgba(0,0,0,.6)", borderRadius: 12,
              padding: "10px 16px", color: "#fff", fontSize: 14,
              fontStyle: "italic", textAlign: "center",
              pointerEvents: "none",
            }}>
              {note.noteText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══ PLANS ═══ */
function PlansView({ proj, plans, isA }) {
  const gIcon = n => { const ext = (n || "").split(".").pop().toLowerCase(); if (ext === "pdf") return { l: "PDF", c: "#E85D5D" }; if (["dwg", "dxf", "dwf"].includes(ext)) return { l: "CAD", c: "#E8853A" }; if (["ai", "eps"].includes(ext)) return { l: "AI", c: "#FF9F0A" }; if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff", "tif"].includes(ext)) return { l: "IMG", c: "#2BAA8E" }; return { l: ext.toUpperCase(), c: "#8B6DC4" }; };
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
      {isA && <label style={{ ...S.btnP, marginBottom: 14, cursor: "pointer", display: "inline-flex" }}><Ic d={P.plus} size={14} /> Subir planos<input type="file" accept=".pdf,.dwg,.dxf,.dwf,.dws,.dgn,.ai,.eps,.svg,image/*" multiple style={{ display: "none" }} onChange={upload} /></label>}
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
function NPanel({ notifications, close, go, anim }) {
  const ovClass = anim === "exit" ? "ov-out" : "ov-in";
  const panClass = anim === "exit" ? "drawer-out" : "drawer-in";
  return (
    <div className={ovClass} style={S.nOv} onClick={close}>
      <div className={panClass} style={S.nPan} onClick={e => e.stopPropagation()}>
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
  root: { display: "flex", flexDirection: "column", height: "100vh", background: "#F2F2F7", fontFamily: "-apple-system,'SF Pro Display','Helvetica Neue',sans-serif", overflow: "hidden", color: "#333", position: "relative" },
  projOverlay: { position: "fixed", inset: 0, background: "#F2F2F7", display: "flex", flexDirection: "column", zIndex: 100 },
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
  chipBtn: { padding: "5px 12px", borderRadius: 20, background: "#F7F7F9", border: "1.5px solid #e0e0e0", color: "#555", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .15s" },
  calBtn: { width: 34, height: 34, borderRadius: 12, background: "#FFF3E8", border: "1.5px solid #F5D5B5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 },
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
