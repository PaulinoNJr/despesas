import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import { Bell, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, CreditCard, Database, Download, Home, KeyRound, LayoutList, LockKeyhole, LogOut, Menu, MoreHorizontal, Plus, Settings, ShieldCheck, Trash2, TrendingDown, TrendingUp, Users, WalletCards, X } from 'lucide-react'
import './styles.css'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const money = value => currency.format(Number(value || 0))
const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const today = new Date()
const dateLabel = date => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00`))
const periodKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const seed = {
  people: [
    { id: 'p1', name: 'Você', color: '#7067cf' },
    { id: 'p2', name: 'Parceiro(a)', color: '#f39c75' },
  ],
  incomes: [
    { id: 'i1', personId: 'p1', value: 2800, payDay: 5 },
    { id: 'i2', personId: 'p1', value: 2000, payDay: 20 },
    { id: 'i3', personId: 'p2', value: 3200, payDay: 7 },
  ],
  bills: [
    { id: 'b1', name: 'Aluguel', value: 1450, dueDay: 8, type: 'Fixa', category: 'Moradia', responsible: 'p1', status: 'pending' },
    { id: 'b2', name: 'Energia elétrica', value: 180, dueDay: 10, type: 'Flutuante', category: 'Casa', responsible: 'p1', status: 'pending' },
    { id: 'b3', name: 'Internet', value: 119.9, dueDay: 12, type: 'Fixa', category: 'Casa', responsible: 'p2', status: 'paid' },
    { id: 'b4', name: 'Cartão de crédito', value: 780, dueDay: 15, type: 'Flutuante', category: 'Financeiro', responsible: 'p1', status: 'pending' },
    { id: 'b5', name: 'Academia', value: 99.9, dueDay: 20, type: 'Fixa', category: 'Pessoal', responsible: 'p2', status: 'pending' },
  ]
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

function useFinance() {
  const [data, setData] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('conta-clara-data'))
      return saved ? { ...saved, payments: saved.payments || {}, incomes: saved.incomes || [] } : { ...seed, payments: {} }
    } catch { return { ...seed, payments: {} } }
  })
  const [remote, setRemote] = useState(false)
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [connectionError, setConnectionError] = useState('')
  const [preferences, setPreferences] = useState(() => {
    try { return { projectionMonths: 6, ...JSON.parse(localStorage.getItem('conta-clara-preferences')) } } catch { return { projectionMonths: 6 } }
  })

  useEffect(() => {
    if (!supabase) return
    let active = true
    const load = async () => {
      const [people, bills, payments, incomes] = await Promise.all([supabase.from('people').select('*').order('created_at'), supabase.from('bills').select('*').order('due_day'), supabase.from('bill_payments').select('*'), supabase.from('income_payments').select('*').order('pay_day')])
      if (active && !people.error && !bills.error && !payments.error && !incomes.error) {
        const paymentMap = Object.fromEntries(payments.data.filter(p => p.status === 'paid').map(p => [`${p.bill_id}:${p.period}`, 'paid']))
        setData({ people: people.data.map(p => ({ id: p.id, name: p.name, color: p.color })), incomes: incomes.data.map(i => ({ id: i.id, personId: i.person_id, value: Number(i.value), payDay: i.pay_day })), bills: bills.data.map(b => ({ id: b.id, name: b.name, value: Number(b.value), dueDay: b.due_day, type: b.type, category: b.category, responsible: b.responsible })), payments: paymentMap })
        setRemote(true)
        setConnectionError('')
      } else if (active) {
        setConnectionError(people.error?.message || bills.error?.message || payments.error?.message || incomes.error?.message || 'Não foi possível acessar o banco.')
      }
    }
    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      setUser(session?.user || null)
      if (session) await load()
      if (active) setAuthReady(true)
    }
    initialize()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setUser(session?.user || null)
      if (session) load()
      else { setRemote(false); setData({ people: [], incomes: [], bills: [], payments: {} }) }
      setAuthReady(true)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  const signIn = async (email, password) => {
    if (!supabase) return 'Configure as variáveis do Supabase para entrar.'
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message || ''
  }
  const signOut = async () => { if (supabase) await supabase.auth.signOut() }
  const changePassword = async (currentPassword, password) => {
    if (!supabase) return 'A conexão com o Supabase não está configurada.'
    const { error } = await supabase.auth.updateUser({ password, current_password: currentPassword })
    return error?.message || ''
  }
  const updatePreferences = updates => {
    const next = { ...preferences, ...updates }
    setPreferences(next)
    localStorage.setItem('conta-clara-preferences', JSON.stringify(next))
  }

  const save = async (next, operation) => {
    setData(next)
    localStorage.setItem('conta-clara-data', JSON.stringify(next))
    if (!supabase || !operation) return
    const { table, action, payload, id } = operation
    if (action === 'insert') await supabase.from(table).insert(payload)
    if (action === 'update') await supabase.from(table).update(payload).eq('id', id)
    if (action === 'delete') await supabase.from(table).delete().eq('id', id)
  }
  const addPerson = async person => {
    const next = { ...data, people: [...data.people, person], incomes: [...data.incomes, ...person.incomes] }
    setData(next)
    localStorage.setItem('conta-clara-data', JSON.stringify(next))
    if (!supabase) return
    const total = person.incomes.reduce((sum, income) => sum + income.value, 0)
    await supabase.from('people').insert({ id: person.id, name: person.name, salary: total, pay_day: person.incomes[0].payDay, color: person.color })
    await supabase.from('income_payments').insert(person.incomes.map(income => ({ id: income.id, person_id: person.id, value: income.value, pay_day: income.payDay })))
  }
  const addIncome = async income => {
    const next = { ...data, incomes: [...data.incomes, income] }
    setData(next)
    localStorage.setItem('conta-clara-data', JSON.stringify(next))
    if (supabase) await supabase.from('income_payments').insert({ id: income.id, person_id: income.personId, value: income.value, pay_day: income.payDay })
  }
  const addBill = bill => save({ ...data, bills: [...data.bills, bill] }, { table: 'bills', action: 'insert', payload: { id: bill.id, name: bill.name, value: bill.value, due_day: bill.dueDay, type: bill.type, category: bill.category, responsible: bill.responsible } })
  const getStatus = (bill, period) => data.payments?.[`${bill.id}:${period}`] || 'pending'
  const toggleBill = async (bill, period) => {
    const key = `${bill.id}:${period}`
    const wasPaid = getStatus(bill, period) === 'paid'
    const payments = { ...data.payments }
    if (wasPaid) delete payments[key]; else payments[key] = 'paid'
    const next = { ...data, payments }
    setData(next)
    localStorage.setItem('conta-clara-data', JSON.stringify(next))
    if (!supabase) return
    if (wasPaid) await supabase.from('bill_payments').delete().eq('bill_id', bill.id).eq('period', period)
    else await supabase.from('bill_payments').upsert({ bill_id: bill.id, period, status: 'paid' }, { onConflict: 'bill_id,period' })
  }
  const remove = (kind, id) => {
    const next = { ...data, [kind]: data[kind].filter(item => item.id !== id), ...(kind === 'people' ? { incomes: data.incomes.filter(income => income.personId !== id) } : {}) }
    return save(next, { table: kind === 'people' ? 'people' : kind === 'incomes' ? 'income_payments' : 'bills', action: 'delete', id })
  }
  return { ...data, remote, user, authReady, connectionError, preferences, signIn, signOut, changePassword, updatePreferences, addPerson, addIncome, addBill, toggleBill, getStatus, remove }
}

function LoadingPage() {
  return <div className="auth-page"><div className="auth-card loading-card"><span className="brand-mark"><CircleDollarSign size={26}/></span><h1>Conta Clara</h1><p>Verificando sua sessão…</p><div className="loader"/></div></div>
}

function LoginPage({ onLogin, missingConfig, connectionError }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async event => {
    event.preventDefault()
    setError('')
    setLoading(true)
    const message = await onLogin(email, password)
    setLoading(false)
    if (message) setError(message === 'Invalid login credentials' ? 'E-mail ou senha inválidos.' : message)
  }
  return <div className="auth-page"><div className="auth-orb orb-one"/><div className="auth-orb orb-two"/><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><CircleDollarSign size={26}/></span><span>conta<span>clara</span></span></div>{missingConfig ? <><h1>Configuração necessária</h1><p>Adicione as variáveis do Supabase na Vercel para liberar o acesso.</p></> : <><div className="lock-circle"><LockKeyhole size={21}/></div><p className="eyebrow">ÁREA RESTRITA</p><h1>Bem-vindo de volta</h1><p>Entre para acompanhar as contas da sua casa.</p><form onSubmit={submit}><label>E-mail<input autoFocus type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@email.com"/></label><label>Senha<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Sua senha"/></label>{(error || connectionError) && <div className="login-error">{error || connectionError}</div>}<button className="primary login-submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar na conta'}</button></form><small className="auth-hint">Seu acesso é criado pelo administrador da aplicação.</small></>}</section></div>
}

function App() {
  const finance = useFinance()
  const [page, setPage] = useState('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [monthOffset, setMonthOffset] = useState(0)
  const [modal, setModal] = useState(null)
  const current = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const navigate = target => { setPage(target); setMenuOpen(false) }
  const nav = [{ id: 'home', label: 'Visão geral', icon: Home }, { id: 'people', label: 'Cadastros', icon: Users }, { id: 'bills', label: 'Lançamentos', icon: LayoutList }]

  if (!supabase) return <LoginPage missingConfig />
  if (!finance.authReady) return <LoadingPage />
  if (!finance.user) return <LoginPage onLogin={finance.signIn} connectionError={finance.connectionError}/>

  return <div className="app-shell">
    <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><span className="brand-mark"><CircleDollarSign size={23}/></span><span>conta<span>clara</span></span><button className="mobile-close" onClick={() => setMenuOpen(false)}><X size={20}/></button></div>
      <nav>{nav.map(item => <button key={item.id} onClick={() => navigate(item.id)} className={page === item.id ? 'active' : ''}><item.icon size={19}/>{item.label}</button>)}</nav>
      <div className="sidebar-bottom"><button onClick={() => navigate('settings')} className={page === 'settings' ? 'active' : ''}><Settings size={19}/>Configurações</button><div className="profile"><div className="avatar">{finance.user.email?.slice(0,2).toUpperCase() || 'CC'}</div><div><strong>Minha conta</strong><small>{finance.user.email}</small></div><div className="profile-menu-wrap"><button className="profile-more" title="Opções da conta" onClick={() => setProfileMenuOpen(!profileMenuOpen)}><MoreHorizontal size={18}/></button>{profileMenuOpen && <div className="profile-popover"><button onClick={() => { setProfileMenuOpen(false); finance.signOut() }}><LogOut size={16}/>Sair da conta</button></div>}</div></div></div>
    </aside>
    {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
    <main>
      <header><button className="menu-btn" onClick={() => setMenuOpen(true)}><Menu/></button><div className="mobile-title">conta<span>clara</span></div><div className="header-actions"><div className="sync-dot" title={finance.remote ? 'Sincronizado com Supabase' : finance.connectionError || 'Sincronizando'}>{finance.remote ? 'Supabase' : 'Conectando'}</div><button className="icon-button"><Bell size={19}/><i/></button></div></header>
      {page === 'home' && <Dashboard finance={finance} current={current} offset={monthOffset} setOffset={setMonthOffset} openModal={setModal}/>} 
      {page === 'people' && <People finance={finance} openModal={setModal}/>} 
      {page === 'bills' && <Bills finance={finance} openModal={setModal}/>} 
      {page === 'settings' && <SettingsPage finance={finance}/>}
    </main>
    {modal === 'person' && <PersonModal onClose={() => setModal(null)} onSave={person => { finance.addPerson(person); setModal(null) }}/>} 
    {modal === 'bill' && <BillModal people={finance.people} onClose={() => setModal(null)} onSave={bill => { finance.addBill(bill); setModal(null) }}/>} 
    {modal?.type === 'income' && <IncomeModal person={modal.person} onClose={() => setModal(null)} onSave={income => { finance.addIncome(income); setModal(null) }}/>}
  </div>
}

function Dashboard({ finance, current, offset, setOffset, openModal }) {
  const period = periodKey(current)
  const bills = finance.bills.map(b => ({ ...b, status: finance.getStatus(b, period) }))
  const income = finance.incomes.reduce((sum, item) => sum + item.value, 0)
  const expenses = bills.reduce((sum, b) => sum + b.value, 0)
  const paid = bills.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.value, 0)
  const remaining = expenses - paid
  const balance = income - expenses
  const sorted = [...bills].sort((a,b) => a.dueDay - b.dueDay)
  const yearMonth = `${months[current.getMonth()]} ${current.getFullYear()}`
  return <section className="content">
    <div className="page-title"><div><p className="eyebrow">PLANEJAMENTO FINANCEIRO</p><h1>Olá! Veja como está seu mês.</h1><p className="sub">Acompanhe suas contas e mantenha tudo sob controle.</p></div><button className="primary" onClick={() => openModal('bill')}><Plus size={18}/>Novo lançamento</button></div>
    <div className="month-control"><button onClick={() => setOffset(offset - 1)}><ChevronLeft size={18}/></button><div><CalendarDays size={17}/>{yearMonth}</div><button onClick={() => setOffset(offset + 1)}><ChevronRight size={18}/></button></div>
    <div className="cards">
      <Metric label="Receitas do mês" value={money(income)} icon={<TrendingUp/>} tint="purple" detail={`${finance.incomes.length} recebimento${finance.incomes.length !== 1 ? 's' : ''} programado${finance.incomes.length !== 1 ? 's' : ''}`}/>
      <Metric label="Contas do mês" value={money(expenses)} icon={<TrendingDown/>} tint="coral" detail={`${bills.length} lançamento${bills.length !== 1 ? 's' : ''} recorrente${bills.length !== 1 ? 's' : ''}`}/>
      <Metric label="Saldo projetado" value={money(balance)} icon={<WalletCards/>} tint={balance < 0 ? 'coral' : 'green'} detail={balance >= 0 ? 'Disponível após as contas' : 'Atenção: saldo negativo'}/>
    </div>
    <div className="dashboard-grid">
      <article className="panel upcoming"><div className="panel-head"><div><h2>Próximos vencimentos</h2><p>Organize-se para os próximos pagamentos</p></div><button className="text-button" onClick={() => openModal('bill')}>Adicionar</button></div>
        <div className="bill-list">{sorted.slice(0,5).map(b => <BillRow key={b.id} bill={b} person={finance.people.find(p => p.id === b.responsible)} onToggle={() => finance.toggleBill(b, period)}/>)}</div>
        {sorted.length === 0 && <Empty text="Nenhuma conta cadastrada ainda."/>}
      </article>
      <article className="panel progress-panel"><div className="panel-head"><div><h2>Andamento do mês</h2><p>Você já pagou {money(paid)} em contas</p></div><span className="percentage">{expenses ? Math.round((paid/expenses)*100) : 0}%</span></div><div className="progress"><span style={{width: `${expenses ? Math.min((paid/expenses)*100, 100) : 0}%`}}/></div><div className="progress-label"><span>Pago</span><strong>{money(paid)}</strong></div><div className="progress-label"><span>Falta pagar</span><strong>{money(remaining)}</strong></div><hr/><div className="small-stats"><div><span>Contas pagas</span><b>{bills.filter(b=>b.status==='paid').length}</b></div><div><span>Pendentes</span><b>{bills.filter(b=>b.status!=='paid').length}</b></div></div></article>
    </div>
    <article className="panel projection"><div className="panel-head"><div><h2>Projeção dos próximos meses</h2><p>Estimativa baseada nas receitas e contas recorrentes cadastradas</p></div></div><div className="projection-bars">{Array.from({ length: finance.preferences.projectionMonths }, (_, i) => i).map(i => { const d = new Date(today.getFullYear(), today.getMonth()+i, 1); const future = balance * (i+1); return <div className="bar-col" key={i}><div className="bar-value">{money(future)}</div><div className="bar-track"><span style={{height: `${Math.max(22, Math.min(100, 22 + i*14))}%`}}/></div><small>{months[d.getMonth()].slice(0,3)}</small></div>})}</div></article>
  </section>
}

function Metric({ label, value, icon, tint, detail }) { return <article className="metric"><div className={`metric-icon ${tint}`}>{icon}</div><p>{label}</p><h2>{value}</h2><small>{detail}</small></article> }
function BillRow({ bill, person, onToggle }) { return <div className="bill-row"><button aria-label="Marcar pagamento" onClick={onToggle} className={bill.status === 'paid' ? 'check paid' : 'check'}>{bill.status === 'paid' && '✓'}</button><div className="due-date"><b>{String(bill.dueDay).padStart(2,'0')}</b><span>{today.toLocaleDateString('pt-BR', {month:'short'}).replace('.','')}</span></div><div className="bill-info"><strong>{bill.name}</strong><span>{bill.category} {person ? `· ${person.name}` : ''}</span></div><strong className={bill.status === 'paid' ? 'paid-value' : ''}>{money(bill.value)}</strong><span className={bill.status === 'paid' ? 'status paid-status' : 'status'}>{bill.status === 'paid' ? 'Pago' : 'Pendente'}</span></div> }
function Empty({ text }) { return <div className="empty">{text}</div> }

function People({ finance, openModal }) {
  return <section className="content"><div className="page-title"><div><p className="eyebrow">CADASTROS</p><h1>Pessoas e receitas</h1><p className="sub">Cadastre quem contribui para o orçamento da casa.</p></div><button className="primary" onClick={() => openModal('person')}><Plus size={18}/>Nova pessoa</button></div><div className="info-strip"><Users size={20}/><span>Inclua quantos recebimentos quiser para cada pessoa.</span></div><div className="person-grid">{finance.people.map(p => { const incomes = finance.incomes.filter(income => income.personId === p.id).sort((a,b) => a.payDay - b.payDay); const total = incomes.reduce((sum, income) => sum + income.value, 0); return <article className="person-card" key={p.id}><div className="person-card-top"><div className="person-avatar" style={{background:p.color}}>{p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><button className="delete" onClick={() => finance.remove('people', p.id)}><Trash2 size={17}/></button></div><h2>{p.name}</h2><div className="income-list">{incomes.map(income => <div key={income.id}><span>Dia {income.payDay}</span><b>{money(income.value)}</b><button className="delete income-delete" title="Remover pagamento" onClick={() => finance.remove('incomes', income.id)}><X size={13}/></button></div>)}</div><button className="add-income" onClick={() => openModal({ type: 'income', person: p })}><Plus size={14}/>Adicionar pagamento</button><div className="salary"><span>Total mensal</span><strong>{money(total)}</strong></div></article>})}{finance.people.length === 0 && <Empty text="Cadastre a primeira pessoa para começar."/>}</div></section>
}

function SettingsPage({ finance }) {
  const exportBackup = () => {
    const backup = { exportedAt: new Date().toISOString(), people: finance.people, incomes: finance.incomes, bills: finance.bills, payments: finance.payments }
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `conta-clara-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  return <section className="content settings-page"><div className="page-title"><div><p className="eyebrow">CONFIGURAÇÕES</p><h1>Seu espaço, suas regras.</h1><p className="sub">Gerencie acesso, preferências e uma cópia dos seus dados.</p></div></div><div className="settings-grid"><article className="panel settings-card account-card"><div className="settings-icon purple"><ShieldCheck/></div><h2>Conta protegida</h2><p>Você está conectado com segurança usando o Supabase.</p><div className="account-email"><span>{finance.user.email?.slice(0,2).toUpperCase()}</span><div><strong>{finance.user.email}</strong><small><CheckCircle2 size={13}/>E-mail autenticado</small></div></div></article><PasswordCard changePassword={finance.changePassword}/><article className="panel settings-card"><div className="settings-icon coral"><CalendarDays/></div><h2>Visão de futuro</h2><p>Escolha o alcance da projeção apresentada na página inicial.</p><label className="settings-label">Meses na projeção<select value={finance.preferences.projectionMonths} onChange={event => finance.updatePreferences({ projectionMonths: Number(event.target.value) })}><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option></select></label><small className="settings-note">Essa preferência fica salva neste dispositivo.</small></article><article className="panel settings-card"><div className="settings-icon green"><Database/></div><h2>Seus dados</h2><p>Faça uma cópia portátil das pessoas, receitas, contas e pagamentos.</p><button className="secondary settings-action" onClick={exportBackup}><Download size={16}/>Exportar backup (.json)</button><small className="settings-note">O arquivo não contém sua senha nem credenciais.</small></article><article className="panel settings-card privacy-card"><div className="settings-icon purple"><CreditCard/></div><h2>Privacidade financeira</h2><p>Seus dados são separados por usuário no banco. Nenhuma outra conta consegue visualizar seus lançamentos.</p><div className="privacy-badge"><ShieldCheck size={16}/>Protegido por RLS</div></article></div></section>
}

function PasswordCard({ changePassword }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async event => {
    event.preventDefault()
    if (password.length < 8) return setStatus('Use pelo menos 8 caracteres na nova senha.')
    if (password !== confirmation) return setStatus('As senhas não coincidem.')
    setSaving(true)
    const error = await changePassword(currentPassword, password)
    setSaving(false)
    if (error) return setStatus(error)
    setCurrentPassword('')
    setPassword('')
    setConfirmation('')
    setStatus('Senha alterada com sucesso.')
  }
  return <article className="panel settings-card password-card"><div className="settings-icon purple"><KeyRound/></div><h2>Alterar senha</h2><p>Use uma senha forte e exclusiva para proteger seu acesso.</p><form onSubmit={submit}><label className="settings-label">Senha atual<input required type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} placeholder="Sua senha atual"/></label><label className="settings-label">Nova senha<input required minLength="8" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres"/></label><label className="settings-label">Confirmar nova senha<input required type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="Repita a nova senha"/></label>{status && <div className={status.includes('sucesso') ? 'settings-success' : 'login-error'}>{status}</div>}<button className="primary settings-action" disabled={saving}>{saving ? 'Salvando…' : 'Atualizar senha'}</button></form></article>
}

function Bills({ finance, openModal }) {
  const [filter, setFilter] = useState('Todos')
  const period = periodKey(today)
  const bills = finance.bills.map(b => ({ ...b, status: finance.getStatus(b, period) })).filter(b => filter === 'Todos' || b.type === filter)
  return <section className="content"><div className="page-title"><div><p className="eyebrow">LANÇAMENTOS</p><h1>Contas e dívidas</h1><p className="sub">Registre suas despesas fixas e os valores que variam a cada mês.</p></div><button className="primary" onClick={() => openModal('bill')}><Plus size={18}/>Novo lançamento</button></div><div className="filters">{['Todos','Fixa','Flutuante'].map(item => <button key={item} onClick={() => setFilter(item)} className={filter === item ? 'selected' : ''}>{item === 'Todos' ? 'Todos os lançamentos' : `${item}s`}</button>)}</div><article className="panel table-panel"><div className="table-head"><span>DESCRIÇÃO</span><span>TIPO</span><span>VENCIMENTO</span><span>RESPONSÁVEL</span><span>VALOR</span><span>STATUS</span><span/></div>{bills.map(b => { const p=finance.people.find(x=>x.id===b.responsible); return <div className="table-row" key={b.id}><div><b>{b.name}</b><small>{b.category}</small></div><span className={`tag ${b.type === 'Fixa' ? 'fixed' : 'variable'}`}>{b.type}</span><span>Dia {b.dueDay}</span><span>{p?.name || '—'}</span><strong>{money(b.value)}</strong><button className={b.status === 'paid' ? 'status paid-status clickable' : 'status clickable'} onClick={() => finance.toggleBill(b, period)}>{b.status === 'paid' ? 'Pago' : 'Pendente'}</button><button className="delete" onClick={() => finance.remove('bills', b.id)}><Trash2 size={16}/></button></div>})}{bills.length === 0 && <Empty text="Nenhum lançamento neste filtro."/>}</article></section>
}

function Modal({ title, children, onClose }) { return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={20}/></button></div>{children}</div></div> }
function CurrencyInput({ value, onValueChange, ...props }) {
  const displayValue = value === '' || value === null || value === undefined ? '' : money(value)
  const handleChange = event => {
    const digits = event.target.value.replace(/\D/g, '')
    onValueChange(digits ? Number(digits) / 100 : '')
  }
  return <input {...props} type="text" inputMode="numeric" value={displayValue} onChange={handleChange} />
}
function PersonModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', color: '#7067cf', incomes: [{ value: '', payDay: '5' }] })
  const updateIncome = (index, key, value) => setForm({ ...form, incomes: form.incomes.map((income, i) => i === index ? { ...income, [key]: value } : income) })
  const submit = event => {
    event.preventDefault()
    const validIncomes = form.incomes.filter(income => Number(income.value) > 0)
    if (!form.name || validIncomes.length === 0) return
    const personId = crypto.randomUUID()
    onSave({ id: personId, name: form.name, color: form.color, incomes: validIncomes.map(income => ({ id: crypto.randomUUID(), personId, value: Number(income.value), payDay: Number(income.payDay) })) })
  }
  return <Modal title="Nova pessoa" onClose={onClose}><form onSubmit={submit}><label>Nome<input autoFocus required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Maria Silva"/></label><div className="income-form-head"><span>Recebimentos mensais</span><button type="button" className="text-button" onClick={() => setForm({ ...form, incomes: [...form.incomes, { value: '', payDay: '20' }] })}><Plus size={14}/>Adicionar</button></div>{form.incomes.map((income, index) => <div className="form-row income-form-row" key={index}><label>Valor<CurrencyInput required value={income.value} onValueChange={value => updateIncome(index, 'value', value)} placeholder="R$ 0,00"/></label><label>Dia de recebimento<input required min="1" max="31" type="number" value={income.payDay} onChange={event => updateIncome(index, 'payDay', event.target.value)}/></label>{form.incomes.length > 1 && <button className="delete remove-income-form" type="button" onClick={() => setForm({ ...form, incomes: form.incomes.filter((_, i) => i !== index) })}><X size={16}/></button>}</div>)}<label>Cor de identificação<input className="color-input" type="color" value={form.color} onChange={event => setForm({ ...form, color: event.target.value })}/></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">Salvar pessoa</button></div></form></Modal>
}

function IncomeModal({ person, onClose, onSave }) {
  const [form, setForm] = useState({ value: '', payDay: '20' })
  const submit = event => { event.preventDefault(); if (!Number(form.value)) return; onSave({ id: crypto.randomUUID(), personId: person.id, value: Number(form.value), payDay: Number(form.payDay) }) }
  return <Modal title={`Novo pagamento · ${person.name}`} onClose={onClose}><form onSubmit={submit}><label>Valor do pagamento<CurrencyInput autoFocus required value={form.value} onValueChange={value => setForm({ ...form, value })} placeholder="R$ 0,00"/></label><label>Dia de recebimento<input required min="1" max="31" type="number" value={form.payDay} onChange={event => setForm({ ...form, payDay: event.target.value })}/></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">Adicionar pagamento</button></div></form></Modal>
}
function BillModal({ people, onClose, onSave }) { const [form,setForm]=useState({name:'',value:'',dueDay:'10',type:'Fixa',category:'Casa',responsible:people[0]?.id || ''}); const submit=e=>{e.preventDefault(); if(!form.name || !form.value) return; onSave({...form,id:crypto.randomUUID(),value:Number(form.value),dueDay:Number(form.dueDay),status:'pending'})}; return <Modal title="Novo lançamento" onClose={onClose}><form onSubmit={submit}><label>Descrição<input autoFocus required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex.: Conta de água"/></label><div className="form-row"><label>Valor<CurrencyInput required value={form.value} onValueChange={value => setForm({...form,value})} placeholder="R$ 0,00"/></label><label>Vencimento<input required min="1" max="31" type="number" value={form.dueDay} onChange={e=>setForm({...form,dueDay:e.target.value})}/></label></div><div className="form-row"><label>Tipo<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>Fixa</option><option>Flutuante</option></select></label><label>Categoria<input value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label></div><label>Responsável<select value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})}><option value="">Não definido</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">Salvar lançamento</button></div></form></Modal> }

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
createRoot(document.getElementById('root')).render(<App />)
