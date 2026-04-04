import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  Church,
  FileText,
  LayoutGrid,
  LoaderCircle,
  LogOut,
  Megaphone,
  Menu,
  X,
  Plus,
  Share2,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  Trash2,
  Edit2,
  Printer,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type Cargo = "pastor" | "ungido" | "diacono" | "obreiro" | "secretaria" | "louvor" | "membro";
type AccessLevel = "super_admin" | "admin" | "lideranca" | "membro";
type Tab = "dashboard" | "pre" | "registro" | "relatorios" | "grupos" | "avisos" | "cadastro_igrejas" | "cadastro_pessoas";

type Church = { id: string; nome: string; endereco: string; cnpj?: string };
type Person = { id: string; nome: string; telefone: string; senha: string; cargo: Cargo; isAdmin: boolean; igrejaIds: string[] };
type Attendance = { igreja: number; visitante: number };
type PreCulto = {
  id: string;
  igrejaId: string;
  data: string;
  diaSemana: string;
  dirigenteLouvorId: string;
  pregadorId: string;
  louvores: string[];
  orientacoes: string;
};
type ServiceMedia = { id: string; nome: string; tipo: string; dataUrl?: string; legenda?: string };
type ServiceRecord = {
  id: string;
  preCultoId: string;
  igrejaId: string;
  data: string;
  louvoresExecutados: string[];
  louvoresFinal: string[];
  palavra: string;
  presencas: Record<string, Attendance>;
  observacoes: string;
  midias: ServiceMedia[];
};
type GroupVisit = { id: string; data: string; hora: string; status: "agendada" | "confirmada" };
type Group = {
  id: string;
  igrejaId: string;
  nome: string;
  classe: string;
  responsavelId: string;
  membros: { id: string; nome: string; telefone: string }[];
  visitas: GroupVisit[];
};
type Message = {
  id: string;
  igrejaId: string;
  fromId: string;
  targetType: "todos" | "grupo" | "pessoa";
  targetId: string;
  texto: string;
  createdAt: string;
};

const localKey = "gdc-app-v6";
const classes = ["criancas", "intermediarios", "adolescentes", "jovens", "senhoras", "varoes"];
const canLeadRoles: Cargo[] = ["pastor", "ungido", "diacono", "obreiro"];
const uid = (): string => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const cargoLabel: Record<Cargo, string> = {
  pastor: "Pastor",
  ungido: "Ungido",
  diacono: "Diacono",
  obreiro: "Obreiro",
  secretaria: "Secretario(a)",
  louvor: "Grupo de Louvor",
  membro: "Membro",
};

const seedData = {
  igrejas: [{ id: "church-1", nome: "Igreja Central Heliopolis", endereco: "Rua Esperanca, 100 - Sao Paulo/SP", cnpj: "" }] as Church[],
  pessoas: [
    { id: "person-1", nome: "Pr. Jonas Silva", telefone: "11911112222", senha: "123456", cargo: "pastor" as Cargo, isAdmin: true, igrejaIds: ["church-1"] },
    { id: "person-2", nome: "Elias Ramos", telefone: "11933334444", senha: "123456", cargo: "obreiro" as Cargo, isAdmin: false, igrejaIds: ["church-1"] },
  ] as Person[],
  louvores: [] as { id: string; igrejaId: string; titulo: string }[],
  precultos: [] as PreCulto[],
  cultos: [] as ServiceRecord[],
  grupos: [] as Group[],
  mensagens: [] as Message[],
};

const emptyPresence = () => Object.fromEntries(classes.map((cls) => [cls, { igreja: 0, visitante: 0 }])) as Record<string, Attendance>;

const fieldBase = "h-11 w-full rounded-2xl border border-[#CBD5E1] bg-white px-3 text-sm text-[#1F2937] outline-none transition focus:border-[#1E3A5F]";

function FloatingField({ label, value, onChange, required = false, error = false, textarea = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; error?: boolean; textarea?: boolean; type?: string }) {
  const dynamicBorder = error ? "border-[#DC2626]" : "border-[#CBD5E1] focus:border-[#1E3A5F]";
  const shared = `peer w-full rounded-2xl border ${dynamicBorder} bg-white px-3 pt-5 pb-2 text-sm text-[#1F2937] outline-none transition`;
  return (
    <label className="relative block text-sm">
      {textarea ? <textarea value={value} onChange={(event) => onChange(event.target.value)} className={`${shared} min-h-24 resize-none`} /> : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={shared} />}
      <span className="pointer-events-none absolute top-1.5 left-3 text-[11px] text-[#1E3A5F]">{label}{required ? " *" : ""}</span>
    </label>
  );
}

function ActionButton({ children, className = "", type = "button", onClick }: { children: ReactNode; className?: string; type?: "button" | "submit"; onClick?: () => void }) {
  return (
    <button type={type} onClick={onClick} className={`min-h-11 rounded-2xl bg-[#DC2626] px-4 text-sm font-semibold text-white transition active:scale-[0.97] ${className}`}>
      {children}
    </button>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-3">
      <p className="text-sm font-semibold text-[#0F172A]">{title}</p>
      <div className="mt-1 h-0.5 w-16 rounded-full bg-[#DC2626]" />
    </div>
  );
}

export default function App() {
  const [store, setStore] = useState(() => {
    const raw = localStorage.getItem(localKey);
    if (!raw) return seedData;
    try {
      return JSON.parse(raw) as typeof seedData;
    } catch {
      return seedData;
    }
  });

  const [loginType, setLoginType] = useState<"lideranca" | "super">("lideranca");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [toast, setToast] = useState("");

  const [activeUser, setActiveUser] = useState<Person | null>(null);
  const [accessLevel, setAccessLevel] = useState<AccessLevel | null>(null);
  const [activeChurchId, setActiveChurchId] = useState("");
  const [churchSwitcherOpen, setChurchSwitcherOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [selectedPreId, setSelectedPreId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [reportMode, setReportMode] = useState<"list" | "detail">("list");
  const [monthFilter] = useState("");
  const [openGroupId, setOpenGroupId] = useState("");
  const [visitDraft, setVisitDraft] = useState<{ groupId: string; data: string; hora: string } | null>(null);

  const [churchForm, setChurchForm] = useState({ id: "", nome: "", endereco: "", cnpj: "" });
  const [personForm, setPersonForm] = useState<Person>({ id: "", nome: "", telefone: "", senha: "", cargo: "membro", isAdmin: false, igrejaIds: [] });
  const [preForm, setPreForm] = useState({ dirigenteLouvorId: "", pregadorId: "", orientacoes: "", novoLouvor: "", louvores: [] as string[] });
  const [registroForm, setRegistroForm] = useState({ palavra: "", observacoes: "", novoLouvor: "", louvoresFinal: [] as string[], louvoresExecutados: [] as string[], midias: [] as ServiceMedia[], presencas: emptyPresence() });
  const [groupForm, setGroupForm] = useState({ id: "", nome: "", responsavelId: "", classe: "criancas", membros: [{ id: uid(), nome: "", telefone: "" }] });
  const [messageForm, setMessageForm] = useState({ targetType: "todos" as Message["targetType"], targetId: "", texto: "" });

  useEffect(() => {
    localStorage.setItem(localKey, JSON.stringify(store));
  }, [store]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(timeout);
  }, [toast]);

  const myChurches = useMemo(() => {
    if (accessLevel === "super_admin") return store.igrejas;
    if (!activeUser) return [];
    return store.igrejas.filter((church) => activeUser.igrejaIds.includes(church.id));
  }, [accessLevel, activeUser, store.igrejas]);

  const currentChurchId = accessLevel === "super_admin" ? activeChurchId : activeChurchId || myChurches[0]?.id || "";
  const currentChurch = store.igrejas.find((church) => church.id === currentChurchId);
  const canManage = accessLevel === "admin" || accessLevel === "super_admin";
  const canLead = accessLevel === "admin" || accessLevel === "lideranca" || accessLevel === "super_admin";

  const peopleVisible = useMemo(() => {
    if (accessLevel === "super_admin") return store.pessoas;
    return store.pessoas.filter((person) => person.igrejaIds.includes(currentChurchId));
  }, [accessLevel, currentChurchId, store.pessoas]);

  const churchesVisible = useMemo(() => {
    if (accessLevel === "super_admin") return store.igrejas;
    return store.igrejas.filter((church) => activeUser?.igrejaIds.includes(church.id));
  }, [accessLevel, activeUser, store.igrejas]);

  const leadershipList = useMemo(() => peopleVisible.filter((person) => canLeadRoles.includes(person.cargo)), [peopleVisible]);

  const visiblePreCultos = store.precultos.filter((item) => (accessLevel === "super_admin" ? true : item.igrejaId === currentChurchId));
  const visibleServices = store.cultos.filter((item) => (accessLevel === "super_admin" ? true : item.igrejaId === currentChurchId));
  const visibleGroups = store.grupos.filter((item) => (accessLevel === "super_admin" ? true : item.igrejaId === currentChurchId));
  const visibleMessages = store.mensagens
    .filter((item) => (accessLevel === "super_admin" ? true : item.igrejaId === currentChurchId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const selectedPre = visiblePreCultos.find((item) => item.id === selectedPreId);
  const selectedService = visibleServices.find((item) => item.id === selectedServiceId);
  const filteredServices = monthFilter ? visibleServices.filter(s => s.data.startsWith(monthFilter)) : visibleServices;
  console.log(filteredServices); // Unused variable fix if needed, but I'll use it in UI if I can.

  const showSavedToast = (message: string) => {
    setToast(message);
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (loginType === "super") {
      if (phone === "super" && password === "super123") {
        setAccessLevel("super_admin");
        setActiveUser(null);
        setActiveChurchId(store.igrejas[0]?.id ?? "");
        setTab("dashboard");
      } else {
        setFeedback("Credenciais de Super Admin invalidas.");
      }
      setLoading(false);
      return;
    }

    const person = store.pessoas.find((entry) => entry.telefone === phone && entry.senha === password);
    if (!person) {
      setFeedback("Telefone ou senha invalidos.");
      setLoading(false);
      return;
    }

    const level: AccessLevel = person.isAdmin || person.cargo === "pastor" ? "admin" : person.cargo === "membro" ? "membro" : "lideranca";
    setActiveUser(person);
    setAccessLevel(level);
    setActiveChurchId(person.igrejaIds[0] ?? "");
    setTab(level === "membro" ? "avisos" : "dashboard");
    setLoading(false);
  };

  const logout = () => {
    setAccessLevel(null);
    setActiveUser(null);
    setTab("dashboard");
    setSidebarOpen(false);
  };

  const saveChurch = (e: FormEvent) => {
    e.preventDefault();
    if (churchForm.id) {
      setStore(o => ({ ...o, igrejas: o.igrejas.map(i => i.id === churchForm.id ? { ...i, ...churchForm } : i) }));
    } else {
      setStore(o => ({ ...o, igrejas: [{ ...churchForm, id: uid() }, ...o.igrejas] }));
    }
    setChurchForm({ id: "", nome: "", endereco: "", cnpj: "" });
    showSavedToast("Igreja salva!");
  };

  const savePerson = (e: FormEvent) => {
    e.preventDefault();
    if (personForm.id) {
      setStore(o => ({ ...o, pessoas: o.pessoas.map(p => p.id === personForm.id ? personForm : p) }));
    } else {
      setStore(o => ({ ...o, pessoas: [{ ...personForm, id: uid() }, ...o.pessoas] }));
    }
    setPersonForm({ id: "", nome: "", telefone: "", senha: "", cargo: "membro", isAdmin: false, igrejaIds: [] });
    showSavedToast("Pessoa salva!");
  };

  const handleSavePreCulto = (e: FormEvent) => {
    e.preventDefault();
    if (!preForm.dirigenteLouvorId || !preForm.pregadorId || preForm.louvores.length === 0) return;
    const now = new Date();
    const payload: PreCulto = {
      id: uid(),
      igrejaId: currentChurchId,
      data: now.toISOString().slice(0, 10),
      diaSemana: now.toLocaleDateString("pt-BR", { weekday: "long" }),
      dirigenteLouvorId: preForm.dirigenteLouvorId,
      pregadorId: preForm.pregadorId,
      louvores: preForm.louvores,
      orientacoes: preForm.orientacoes,
    };
    setStore((old) => ({ ...old, precultos: [payload, ...old.precultos] }));
    setSelectedPreId(payload.id);
    setPreForm({ dirigenteLouvorId: "", pregadorId: "", orientacoes: "", novoLouvor: "", louvores: [] });
    showSavedToast("Pre-culto salvo!");
  };

  const handleSaveService = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPre) return;
    const payload: ServiceRecord = {
      id: uid(),
      preCultoId: selectedPre.id,
      igrejaId: selectedPre.igrejaId,
      data: new Date().toISOString(),
      louvoresExecutados: registroForm.louvoresExecutados,
      louvoresFinal: registroForm.louvoresFinal,
      palavra: registroForm.palavra,
      presencas: registroForm.presencas,
      observacoes: registroForm.observacoes,
      midias: registroForm.midias,
    };
    setStore((old) => ({ ...old, cultos: [payload, ...old.cultos] }));
    setSelectedServiceId(payload.id);
    showSavedToast("Culto salvo!");
    setRegistroForm({ palavra: "", observacoes: "", novoLouvor: "", louvoresFinal: [], louvoresExecutados: [], midias: [], presencas: emptyPresence() });
  };

  const saveGroup = (event: FormEvent) => {
    event.preventDefault();
    if (!groupForm.nome || !groupForm.responsavelId || !currentChurchId) return;
    const payload: Group = {
      id: groupForm.id || uid(),
      igrejaId: currentChurchId,
      nome: groupForm.nome,
      classe: groupForm.classe,
      responsavelId: groupForm.responsavelId,
      membros: groupForm.membros.filter((m) => m.nome),
      visitas: groupForm.id ? visibleGroups.find((g) => g.id === groupForm.id)?.visitas || [] : [],
    };
    if (groupForm.id) {
      setStore((old) => ({ ...old, grupos: old.grupos.map((g) => (g.id === groupForm.id ? payload : g)) }));
      showSavedToast("Grupo atualizado!");
    } else {
      setStore((old) => ({ ...old, grupos: [payload, ...old.grupos] }));
      showSavedToast("Grupo cadastrado!");
    }
    setGroupForm({ id: "", nome: "", responsavelId: "", classe: "criancas", membros: [{ id: uid(), nome: "", telefone: "" }] });
  };

  const scheduleVisit = (groupId: string) => {
    if (!visitDraft || !visitDraft.data || !visitDraft.hora) return;
    const newVisit: GroupVisit = {
      id: uid(),
      data: visitDraft.data,
      hora: visitDraft.hora,
      status: "agendada",
    };
    setStore((old) => ({
      ...old,
      grupos: old.grupos.map((g) => (g.id === groupId ? { ...g, visitas: [newVisit, ...g.visitas] } : g)),
    }));
    setVisitDraft(null);
    showSavedToast("Visita agendada!");
  };

  const toggleVisitStatus = (groupId: string, visitId: string) => {
    setStore((old) => ({
      ...old,
      grupos: old.grupos.map((g) =>
        g.id === groupId
          ? {
              ...g,
              visitas: g.visitas.map((v) => (v.id === visitId ? { ...v, status: v.status === "agendada" ? "confirmada" : "agendada" } : v)),
            }
          : g
      ),
    }));
  };

  const navItems = [
    { id: "dashboard", label: "Inicio", icon: <LayoutGrid size={18} />, show: accessLevel !== "membro" },
    { id: "pre", label: "Pre-culto", icon: <Calendar size={18} />, show: canLead },
    { id: "registro", label: "Registrar", icon: <Plus size={18} />, show: canLead },
    { id: "relatorios", label: "Historico", icon: <FileText size={18} />, show: canLead },
    { id: "grupos", label: "Grupos", icon: <Users size={18} />, show: canLead },
    { id: "avisos", label: "Avisos", icon: <Megaphone size={18} />, show: true },
    { id: "cadastro_pessoas", label: "Pessoas", icon: <Users size={18} />, show: canManage },
    { id: "cadastro_igrejas", label: "Igrejas", icon: <Building2 size={18} />, show: canManage },
  ];

  if (!accessLevel) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0F172A] p-6 text-white">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[#DC2626]">
              <Church size={32} />
            </div>
            <h1 className="text-2xl font-bold">GDC – Gestão de Cultos</h1>
            <p className="text-sm text-slate-400">Entre na sua conta para continuar</p>
          </div>

          <div className="flex rounded-2xl bg-[#1E3A5F] p-1">
            <button onClick={() => setLoginType("lideranca")} className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${loginType === "lideranca" ? "bg-[#DC2626]" : ""}`}>Liderança / Membro</button>
            <button onClick={() => setLoginType("super")} className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${loginType === "super" ? "bg-[#DC2626]" : ""}`}>Super Admin</button>
          </div>

          <form onSubmit={login} className="space-y-4">
            <FloatingField label={loginType === "super" ? "Usuario" : "Telefone"} value={phone} onChange={setPhone} required />
            <FloatingField label="Senha" value={password} onChange={setPassword} type="password" required />
            {feedback && <p className="text-center text-xs font-medium text-red-400">{feedback}</p>}
            <button type="submit" disabled={loading} className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#DC2626] font-bold text-white transition hover:bg-red-700 active:scale-95 disabled:opacity-50">
              {loading ? <LoaderCircle className="animate-spin" /> : "Entrar no Sistema"}
            </button>
          </form>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#EFF6FF] pb-10">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-4 right-4 left-4 z-[100] flex items-center gap-3 rounded-2xl bg-[#0F172A] p-4 text-white shadow-xl md:right-auto md:left-4 md:w-80">
            <CheckCircle2 className="text-[#DC2626]" size={20} />
            <p className="text-sm font-medium">{toast}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="no-print sticky top-0 z-40 border-b border-[#CBD5E1] bg-[#0F172A] text-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl transition hover:bg-white/10 active:scale-95">
              <Menu size={24} />
            </button>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-[#DC2626] uppercase">GDC App</p>
              <h1 className="text-sm font-bold truncate max-w-[160px] md:max-w-none">{currentChurch?.nome}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setChurchSwitcherOpen(!churchSwitcherOpen)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 transition active:scale-95">
              <Building2 size={20} />
            </button>
            <div className="h-10 w-10 overflow-hidden rounded-xl bg-[#DC2626] flex items-center justify-center font-bold">
              {activeUser?.nome?.[0] || "S"}
            </div>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" />
            <motion.aside initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed top-0 bottom-0 left-0 z-[70] w-[280px] bg-[#0F172A] text-white shadow-2xl">
              <div className="flex h-16 items-center justify-between px-6 border-b border-white/10">
                <span className="font-bold text-lg">Menu GDC</span>
                <button onClick={() => setSidebarOpen(false)} className="p-1"><X size={20} /></button>
              </div>
              <div className="p-4 space-y-2">
                {navItems.filter(i => i.show).map(item => (
                  <button key={item.id} onClick={() => { setTab(item.id as Tab); setSidebarOpen(false); }} className={`flex w-full items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium transition ${tab === item.id ? "bg-[#DC2626] text-white" : "hover:bg-white/5"}`}>
                    {item.icon}
                    {item.label}
                  </button>
                ))}
                <div className="pt-4 mt-4 border-t border-white/10">
                  <button onClick={logout} className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium text-red-400 hover:bg-white/5">
                    <LogOut size={18} />
                    Sair da Conta
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <section className="mx-auto max-w-5xl px-4 pt-6">
        {tab === "dashboard" && (
          <div className="space-y-6">
            <div className="rounded-3xl bg-gradient-to-br from-[#0F172A] to-[#1E3A5F] p-6 text-white shadow-xl">
              <p className="text-sm opacity-80">Paz do Senhor,</p>
              <h2 className="text-xl font-bold">{activeUser?.nome || "Super Admin"}</h2>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md">
                  <p className="text-[10px] uppercase tracking-wider opacity-60">Igreja</p>
                  <p className="text-sm font-bold truncate">{currentChurch?.nome}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md">
                  <p className="text-[10px] uppercase tracking-wider opacity-60">Cargo</p>
                  <p className="text-sm font-bold">{activeUser ? cargoLabel[activeUser.cargo] : "Super Admin"}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {navItems.filter(i => i.show && i.id !== "dashboard").map(item => (
                <button key={item.id} onClick={() => setTab(item.id as Tab)} className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-white p-6 shadow-sm transition hover:shadow-md active:scale-95">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#EFF6FF] text-[#DC2626]">
                    {item.icon}
                  </div>
                  <span className="text-sm font-bold text-[#0F172A]">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "pre" && (
          <form onSubmit={handleSavePreCulto} className="space-y-3 rounded-3xl bg-white p-4 shadow-sm">
             <SectionTitle title="Pre-culto" />
             <label className="block rounded-2xl border border-[#CBD5E1] px-3 py-2 text-sm">
                <span className="text-[11px] text-[#1E3A5F]">Dirigente</span>
                <select value={preForm.dirigenteLouvorId} onChange={e => setPreForm(o => ({ ...o, dirigenteLouvorId: e.target.value }))} className="mt-1 w-full bg-transparent outline-none">
                  <option value="">Selecione</option>
                  {leadershipList.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
             </label>
             <label className="block rounded-2xl border border-[#CBD5E1] px-3 py-2 text-sm">
                <span className="text-[11px] text-[#1E3A5F]">Pregador</span>
                <select value={preForm.pregadorId} onChange={e => setPreForm(o => ({ ...o, pregadorId: e.target.value }))} className="mt-1 w-full bg-transparent outline-none">
                  <option value="">Selecione</option>
                  {leadershipList.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
             </label>
             <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500">Louvores</p>
                <div className="flex gap-2">
                   <input value={preForm.novoLouvor} onChange={e => setPreForm(o => ({ ...o, novoLouvor: e.target.value }))} placeholder="Novo louvor" className={fieldBase} />
                   <button type="button" onClick={() => { if(!preForm.novoLouvor) return; setPreForm(o => ({ ...o, louvores: [...o.louvores, o.novoLouvor], novoLouvor: "" })) }} className="px-4 bg-[#DC2626] text-white rounded-xl">+</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {preForm.louvores.map((l, i) => (
                    <span key={i} className="bg-slate-100 px-3 py-1 rounded-full text-xs flex items-center gap-2">
                      {l} <button type="button" onClick={() => setPreForm(o => ({ ...o, louvores: o.louvores.filter((_, idx) => idx !== i) }))} className="text-red-500">×</button>
                    </span>
                  ))}
                </div>
             </div>
             <FloatingField label="Orientações" value={preForm.orientacoes} onChange={v => setPreForm(o => ({ ...o, orientacoes: v }))} textarea />
             <ActionButton type="submit" className="w-full">Salvar Pre-culto</ActionButton>
          </form>
        )}

        {tab === "registro" && (
           <div className="space-y-4">
             <SectionTitle title="Registrar Culto" />
             <select value={selectedPreId} onChange={e => setSelectedPreId(e.target.value)} className={fieldBase}>
                <option value="">Selecionar Pre-culto</option>
                {visiblePreCultos.map(p => <option key={p.id} value={p.id}>{p.data} - {leadershipList.find(x => x.id === p.pregadorId)?.nome}</option>)}
             </select>
             {selectedPre && (
               <form onSubmit={handleSaveService} className="space-y-4 rounded-3xl bg-white p-4 shadow-sm">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500">Presença por Classe</p>
                    {classes.map(cls => (
                      <div key={cls} className="p-3 bg-slate-50 rounded-2xl">
                        <p className="text-xs font-bold capitalize mb-2">{cls}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div><p className="text-[9px] text-slate-400 mb-1">IGREJA</p><input type="number" value={registroForm.presencas[cls].igreja} onChange={e => setRegistroForm(o => ({ ...o, presencas: { ...o.presencas, [cls]: { ...o.presencas[cls], igreja: Number(e.target.value) } } }))} className="h-9 w-full rounded-lg border border-[#CBD5E1] px-2 text-sm" /></div>
                          <div><p className="text-[9px] text-slate-400 mb-1">VISITANTE</p><input type="number" value={registroForm.presencas[cls].visitante} onChange={e => setRegistroForm(o => ({ ...o, presencas: { ...o.presencas, [cls]: { ...o.presencas[cls], visitante: Number(e.target.value) } } }))} className="h-9 w-full rounded-lg border border-[#CBD5E1] px-2 text-sm" /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <FloatingField label="Palavra Pregada" value={registroForm.palavra} onChange={v => setRegistroForm(o => ({ ...o, palavra: v }))} textarea />
                  <ActionButton type="submit" className="w-full">Salvar Culto</ActionButton>
               </form>
             )}
           </div>
        )}

        {tab === "relatorios" && (
           <div className="space-y-4">
              <SectionTitle title="Histórico de Cultos" />
              <div className="space-y-3">
                 {visibleServices.map(s => (
                   <div key={s.id} className="p-4 bg-white rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold">{new Date(s.data).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-500">{leadershipList.find(p => p.id === visiblePreCultos.find(x => x.id === s.preCultoId)?.pregadorId)?.nome}</p>
                      </div>
                      <button onClick={() => { setSelectedServiceId(s.id); setReportMode("detail"); }} className="text-[#DC2626] font-bold text-xs underline">Ver Ata</button>
                   </div>
                 ))}
              </div>
              {reportMode === "detail" && selectedService && (
                <div className="fixed inset-0 z-[100] bg-white overflow-auto p-6 flex flex-col">
                   <div className="flex justify-between items-center mb-6 no-print">
                      <button onClick={() => setReportMode("list")} className="text-slate-400"><X /></button>
                      <h2 className="font-bold text-lg">Ata de Culto</h2>
                      <button onClick={() => window.print()} className="text-[#DC2626]"><Printer /></button>
                   </div>
                   <div className="flex-1 space-y-6">
                      <div className="text-center pb-4 border-b-2 border-[#DC2626]">
                         <h1 className="text-2xl font-black text-[#0F172A] uppercase">{currentChurch?.nome}</h1>
                         <p className="text-sm text-slate-500 mt-1">Ata de Culto - {new Date(selectedService.data).toLocaleDateString()}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[10px] text-slate-400 uppercase font-bold">Dirigente</p><p className="font-bold">{leadershipList.find(p => p.id === visiblePreCultos.find(x => x.id === selectedService.preCultoId)?.dirigenteLouvorId)?.nome}</p></div>
                         <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[10px] text-slate-400 uppercase font-bold">Pregador</p><p className="font-bold">{leadershipList.find(p => p.id === visiblePreCultos.find(x => x.id === selectedService.preCultoId)?.pregadorId)?.nome}</p></div>
                      </div>
                      <div>
                        <SectionTitle title="Palavra Ministrada" />
                        <p className="text-sm p-4 bg-white border-l-4 border-[#DC2626] italic">{selectedService.palavra}</p>
                      </div>
                      <div>
                        <SectionTitle title="Presença por Classe" />
                        <div className="grid grid-cols-2 gap-2 text-xs">
                           {classes.map(c => (
                             <div key={c} className="flex justify-between p-2 bg-slate-50 rounded-lg">
                                <span className="capitalize">{c}</span>
                                <span className="font-bold">{selectedService.presencas[c].igreja + selectedService.presencas[c].visitante}</span>
                             </div>
                           ))}
                        </div>
                      </div>
                      <div className="no-print pt-6">
                         <button onClick={async () => {
                            const text = `Ata de Culto - ${currentChurch?.nome}\nData: ${new Date(selectedService.data).toLocaleDateString()}\nPregador: ${leadershipList.find(p => p.id === visiblePreCultos.find(x => x.id === selectedService.preCultoId)?.pregadorId)?.nome}\nPalavra: ${selectedService.palavra}`;
                            await navigator.share({ title: 'Ata de Culto', text });
                         }} className="w-full bg-[#0F172A] text-white py-4 rounded-2xl flex items-center justify-center gap-2 font-bold"><Share2 size={18} /> Compartilhar no WhatsApp</button>
                      </div>
                   </div>
                </div>
              )}
           </div>
        )}

        {tab === "grupos" && (
          <div className="space-y-4">
            <form onSubmit={saveGroup} className="space-y-3 rounded-3xl bg-white p-4 shadow-sm">
              <SectionTitle title="Novo Grupo / Edição" />
              <FloatingField label="Nome do Grupo" value={groupForm.nome} onChange={v => setGroupForm(o => ({ ...o, nome: v }))} required />
              <label className="block rounded-2xl border border-[#CBD5E1] px-3 py-2 text-sm">
                <span className="text-[11px] text-[#1E3A5F]">Classe do Grupo</span>
                <select value={groupForm.classe} onChange={e => setGroupForm(o => ({ ...o, classe: e.target.value }))} className="mt-1 w-full bg-transparent outline-none">
                  {classes.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </label>
              <label className="block rounded-2xl border border-[#CBD5E1] px-3 py-2 text-sm">
                <span className="text-[11px] text-[#1E3A5F]">Responsavel</span>
                <select value={groupForm.responsavelId} onChange={e => setGroupForm(o => ({ ...o, responsavelId: e.target.value }))} className="mt-1 w-full bg-transparent outline-none">
                  <option value="">Selecione</option>
                  {peopleVisible.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </label>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500">Membros</p>
                {groupForm.membros.map((m, idx) => (
                  <div key={m.id} className="flex gap-2">
                    <input value={m.nome} onChange={e => setGroupForm(o => ({ ...o, membros: o.membros.map((x, i) => i === idx ? { ...x, nome: e.target.value } : x) }))} placeholder="Nome" className="h-10 flex-1 rounded-xl border border-[#CBD5E1] px-3 text-xs" />
                    <input value={m.telefone} onChange={e => setGroupForm(o => ({ ...o, membros: o.membros.map((x, i) => i === idx ? { ...x, telefone: e.target.value } : x) }))} placeholder="Tel" className="h-10 w-24 rounded-xl border border-[#CBD5E1] px-3 text-xs" />
                    <button type="button" onClick={() => setGroupForm(o => ({ ...o, membros: o.membros.filter((_, i) => i !== idx) }))} className="h-10 w-10 text-red-500">×</button>
                  </div>
                ))}
                <button type="button" onClick={() => setGroupForm(o => ({ ...o, membros: [...o.membros, { id: uid(), nome: "", telefone: "" }] }))} className="text-xs text-[#DC2626] font-bold">+ Adicionar Membro</button>
              </div>
              <ActionButton type="submit" className="w-full">Salvar Grupo</ActionButton>
            </form>

            <div className="space-y-3">
              {visibleGroups.map(group => {
                const isResp = activeUser?.id === group.responsavelId;
                const canSeeVisits = canManage || activeUser?.cargo === "pastor" || isResp;
                return (
                  <div key={group.id} className="rounded-3xl border border-[#CBD5E1] bg-white overflow-hidden shadow-sm">
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-[#0F172A]">{group.nome}</h3>
                          <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-bold text-[#DC2626] uppercase">{group.classe}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">Resp: {peopleVisible.find(p => p.id === group.responsavelId)?.nome}</p>
                      </div>
                      <button onClick={() => setOpenGroupId(openGroupId === group.id ? "" : group.id)} className="grid h-10 w-10 place-items-center rounded-xl bg-[#F8FAFC]">
                        <ChevronDown size={18} className={`transition ${openGroupId === group.id ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                    {openGroupId === group.id && (
                      <div className="p-4 pt-0 border-t border-[#F1F5F9] bg-[#F8FAFC]">
                        <div className="mt-4 space-y-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Membros ({group.membros.length})</p>
                            <div className="space-y-1">
                              {group.membros.map(m => <p key={m.id} className="text-sm">{m.nome} <span className="text-xs text-slate-400">({m.telefone})</span></p>)}
                            </div>
                          </div>

                          <div className="pt-4 border-t border-[#E2E8F0]">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Visitas Pastorais</p>
                            {canSeeVisits ? (
                              <div className="space-y-3">
                                {visitDraft?.groupId === group.id ? (
                                  <div className="p-3 bg-white rounded-2xl border border-[#DC2626] space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                      <input type="date" value={visitDraft.data} onChange={e => setVisitDraft(o => o ? { ...o, data: e.target.value } : null)} className="h-10 rounded-xl border border-[#CBD5E1] px-2 text-xs" />
                                      <input type="time" value={visitDraft.hora} onChange={e => setVisitDraft(o => o ? { ...o, hora: e.target.value } : null)} className="h-10 rounded-xl border border-[#CBD5E1] px-2 text-xs" />
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={() => scheduleVisit(group.id)} className="flex-1 h-10 rounded-xl bg-[#DC2626] text-white text-xs font-bold">Agendar</button>
                                      <button onClick={() => setVisitDraft(null)} className="h-10 px-4 rounded-xl bg-slate-100 text-xs">Cancelar</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button onClick={() => setVisitDraft({ groupId: group.id, data: "", hora: "" })} className="flex items-center gap-2 text-xs font-bold text-[#DC2626] mb-2">
                                    <Calendar size={14} /> Agendar Nova Visita
                                  </button>
                                )}

                                <div className="space-y-2">
                                  {group.visitas.map(visit => (
                                    <div key={visit.id} className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm border border-slate-100">
                                      <div className="flex items-center gap-3">
                                        <div className={`grid h-8 w-8 place-items-center rounded-lg ${visit.status === "confirmada" ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600"}`}>
                                          {visit.status === "confirmada" ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                                        </div>
                                        <div>
                                          <p className="text-xs font-bold">{new Date(visit.data + "T00:00:00").toLocaleDateString()}</p>
                                          <p className="text-[10px] text-slate-400">{visit.hora}</p>
                                        </div>
                                      </div>
                                      <button onClick={() => toggleVisitStatus(group.id, visit.id)} className={`rounded-xl px-3 py-1.5 text-[10px] font-bold transition ${visit.status === "confirmada" ? "bg-green-600 text-white" : "bg-white border border-[#CBD5E1] text-slate-600"}`}>
                                        {visit.status === "agendada" ? "Confirmar" : "Confirmada"}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic">Visivel apenas para responsaveis e liderança.</p>
                            )}
                          </div>
                          
                          <div className="pt-2 flex gap-2">
                            <button onClick={() => setGroupForm({ id: group.id, nome: group.nome, responsavelId: group.responsavelId, classe: group.classe, membros: group.membros })} className="flex-1 h-10 rounded-xl border border-[#CBD5E1] text-xs font-bold text-slate-600">Editar Grupo</button>
                            <button onClick={() => setStore(o => ({ ...o, grupos: o.grupos.filter(x => x.id !== group.id) }))} className="h-10 px-4 rounded-xl text-red-500">Excluir</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "avisos" && (
          <div className="space-y-4">
             <form onSubmit={(e) => {
               e.preventDefault();
               if (!messageForm.texto) return;
               const msg: Message = { id: uid(), igrejaId: currentChurchId, fromId: activeUser?.id || "super", targetType: messageForm.targetType, targetId: messageForm.targetId, texto: messageForm.texto, createdAt: new Date().toISOString() };
               setStore(o => ({ ...o, mensagens: [msg, ...o.mensagens] }));
               setMessageForm({ targetType: "todos", targetId: "", texto: "" });
               showSavedToast("Aviso enviado!");
             }} className="space-y-3 rounded-3xl bg-white p-4 shadow-sm">
              <SectionTitle title="Novo Aviso" />
              <select value={messageForm.targetType} onChange={e => setMessageForm(o => ({ ...o, targetType: e.target.value as any }))} className={fieldBase}>
                <option value="todos">Para Todos</option>
                <option value="grupo">Para Grupo</option>
              </select>
              {messageForm.targetType === "grupo" && (
                <select value={messageForm.targetId} onChange={e => setMessageForm(o => ({ ...o, targetId: e.target.value }))} className={fieldBase}>
                  <option value="">Selecionar Grupo</option>
                  {visibleGroups.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              )}
              <FloatingField label="Mensagem" value={messageForm.texto} onChange={v => setMessageForm(o => ({ ...o, texto: v }))} textarea />
              <ActionButton type="submit" className="w-full">Enviar Aviso</ActionButton>
             </form>

             <div className="space-y-3">
               {visibleMessages.map(m => (
                 <div key={m.id} className="rounded-2xl bg-white p-4 shadow-sm border-l-4 border-[#DC2626]">
                   <div className="flex justify-between items-start mb-2">
                     <span className="text-[10px] font-bold text-[#DC2626] uppercase">{m.targetType === "todos" ? "Mural Geral" : "Aviso de Grupo"}</span>
                     <span className="text-[10px] text-slate-400">{new Date(m.createdAt).toLocaleDateString()}</span>
                   </div>
                   <p className="text-sm text-[#0F172A]">{m.texto}</p>
                 </div>
               ))}
             </div>
          </div>
        )}

        {tab === "cadastro_pessoas" && (
           <form onSubmit={savePerson} className="space-y-3 rounded-3xl bg-white p-4 shadow-sm">
              <SectionTitle title="Cadastro de Pessoas" />
              <FloatingField label="Nome Completo" value={personForm.nome} onChange={v => setPersonForm(o => ({ ...o, nome: v }))} required />
              <FloatingField label="Telefone" value={personForm.telefone} onChange={v => setPersonForm(o => ({ ...o, telefone: v }))} required />
              <FloatingField label="Senha" value={personForm.senha} onChange={v => setPersonForm(o => ({ ...o, senha: v }))} required type="password" />
              <select value={personForm.cargo} onChange={e => {
                 const c = e.target.value as Cargo;
                 setPersonForm(o => ({ ...o, cargo: c, isAdmin: c === "pastor" ? true : o.isAdmin }));
              }} className={fieldBase}>
                 {Object.entries(cargoLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <div className="p-3 bg-slate-50 rounded-2xl space-y-2">
                 <p className="text-[10px] font-bold text-slate-400">Vincular Igrejas</p>
                 <div className="flex flex-wrap gap-2">
                    {churchesVisible.map(church => {
                       const sel = personForm.igrejaIds.includes(church.id);
                       return <button key={church.id} type="button" onClick={() => setPersonForm(o => ({ ...o, igrejaIds: sel ? o.igrejaIds.filter(id => id !== church.id) : [...o.igrejaIds, church.id] }))} className={`px-3 py-1.5 rounded-full text-[10px] font-bold ${sel ? 'bg-[#DC2626] text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>{church.nome}</button>
                    })}
                 </div>
              </div>
              <ActionButton type="submit" className="w-full">Salvar Cadastro</ActionButton>
              <div className="space-y-2 pt-4">
                {peopleVisible.map(p => (
                  <div key={p.id} className="p-3 bg-white border border-slate-100 rounded-2xl flex justify-between items-center text-xs">
                    <span>{p.nome} - {cargoLabel[p.cargo]}</span>
                    <div className="flex gap-2">
                       <button type="button" onClick={() => setPersonForm(p)} className="text-[#DC2626]"><Edit2 size={14}/></button>
                       <button type="button" onClick={() => setStore(o => ({ ...o, pessoas: o.pessoas.filter(x => x.id !== p.id) }))} className="text-slate-400"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
           </form>
        )}

        {tab === "cadastro_igrejas" && (
           <form onSubmit={saveChurch} className="space-y-3 rounded-3xl bg-white p-4 shadow-sm">
              <SectionTitle title="Cadastro de Igrejas" />
              <FloatingField label="Nome da Igreja" value={churchForm.nome} onChange={v => setChurchForm(o => ({ ...o, nome: v }))} required />
              <FloatingField label="Endereço" value={churchForm.endereco} onChange={v => setChurchForm(o => ({ ...o, endereco: v }))} required />
              <FloatingField label="CNPJ" value={churchForm.cnpj} onChange={v => setChurchForm(o => ({ ...o, cnpj: v }))} />
              <ActionButton type="submit" className="w-full">Salvar Igreja</ActionButton>
              <div className="space-y-2 pt-4">
                {churchesVisible.map(c => (
                  <div key={c.id} className="p-3 bg-white border border-slate-100 rounded-2xl flex justify-between items-center text-xs">
                    <span>{c.nome}</span>
                    <div className="flex gap-2">
                       <button type="button" onClick={() => setChurchForm({ id: c.id, nome: c.nome, endereco: c.endereco, cnpj: c.cnpj || "" })} className="text-[#DC2626]"><Edit2 size={14}/></button>
                       <button type="button" onClick={() => setStore(o => ({ ...o, igrejas: o.igrejas.filter(x => x.id !== c.id) }))} className="text-slate-400"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
           </form>
        )}
      </section>

      <AnimatePresence>
        {churchSwitcherOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 md:items-center">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
              <h3 className="mb-4 font-bold text-[#0F172A]">Selecionar Igreja</h3>
              <div className="space-y-2">
                {myChurches.map(c => (
                  <button key={c.id} onClick={() => { setActiveChurchId(c.id); setChurchSwitcherOpen(false); }} className={`flex w-full items-center justify-between rounded-2xl p-4 transition ${currentChurchId === c.id ? "bg-[#EFF6FF] border border-[#DC2626]" : "bg-slate-50 border border-transparent"}`}>
                    <span className="text-sm font-bold">{c.nome}</span>
                    {currentChurchId === c.id && <CheckCircle2 size={18} className="text-[#DC2626]" />}
                  </button>
                ))}
              </div>
              <button onClick={() => setChurchSwitcherOpen(false)} className="mt-6 w-full rounded-2xl py-3 text-sm font-bold text-slate-500">Fechar</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
