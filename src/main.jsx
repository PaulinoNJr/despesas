import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import { Bell, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, CreditCard, Home, LayoutList, Menu, MoreHorizontal, Plus, Settings, Trash2, TrendingDown, TrendingUp, Users, WalletCards, X } from 'lucide-react'
import './styles.css'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const money = value => currency.format(Number(value || 0))
const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const today = new Date()
const dateLabel = date => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00`))
const periodKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const seed = {
  people: [
    { id: 'p1', name: 'Você', salary: 4800, payDay: 5, color: '#7067cf' },
    { id: 'p2', name: 'Parceiro(a)', salary: 3200, payDay: 7, color: '#f39c75' },
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
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

function useFinance() {
  const [data, setData] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('conta-clara-data'))
      return saved ? { ...saved, payments: saved.payments || {} } : { ...seed, payments: {} }
    } catch { return { ...seed, payments: {} } }
  })
  const [remote, setRemote] = useState(false)

  useEffect(() => {
    if (!supabase) return
    Promise.all([supabase.from('people').select('*').order('created_at'), supabase.from('bills').select('*').order('due_day'), supabase.from('bill_payments').select('*')]).then(([people, bills, payments]) => {
      if (!people.error && !bills.error && !payments.error) {
        const paymentMap = Object.fromEntries(payments.data.filter(p => p.status === 'paid').map(p => [`${p.bill_id}:${p.period}`, 'paid']))
        setData({ people: people.data.map(p => ({ id: p.id, name: p.name, salary: Number(p.salary), payDay: p.pay_day, color: p.color })), bills: bills.data.map(b => ({ id: b.id, name: b.name, value: Number(b.value), dueDay: b.due_day, type: b.type, category: b.category, responsible: b.responsible })), payments: paymentMap })
        setRemote(true)
      }
    })
  }, [])

  const save = async (next, operation) => {
    setData(next)
    localStorage.setItem('conta-clara-data', JSON.stringify(next))
    if (!supabase || !operation) return
    const { table, action, payload, id } = operation
    if (action === 'insert') await supabase.from(table).insert(payload)
    if (action === 'update') await supabase.from(table).update(payload).eq('id', id)
    if (action === 'delete') await supabase.from(table).delete().eq('id', id)
  }
  const addPerson = person => save({ ...data, people: [...data.people, person] }, { table: 'people', action: 'insert', payload: { id: person.id, name: person.name, salary: person.salary, pay_day: person.payDay, color: person.color } })
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
  const remove = (kind, id) => save({ ...data, [kind]: data[kind].filter(item => item.id !== id) }, { table: kind === 'people' ? 'people' : 'bills', action: 'delete', id })
  return { ...data, remote, addPerson, addBill, toggleBill, getStatus, remove }
}

function App() {
  const finance = useFinance()
  const [page, setPage] = useState('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [monthOffset, setMonthOffset] = useState(0)
  const [modal, setModal] = useState(null)
  const current = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const navigate = target => { setPage(target); setMenuOpen(false) }
  const nav = [{ id: 'home', label: 'Visão geral', icon: Home }, { id: 'people', label: 'Cadastros', icon: Users }, { id: 'bills', label: 'Lançamentos', icon: LayoutList }]

  return <div className="app-shell">
    <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><span className="brand-mark"><CircleDollarSign size={23}/></span><span>conta<span>clara</span></span><button className="mobile-close" onClick={() => setMenuOpen(false)}><X size={20}/></button></div>
      <nav>{nav.map(item => <button key={item.id} onClick={() => navigate(item.id)} className={page === item.id ? 'active' : ''}><item.icon size={19}/>{item.label}</button>)}</nav>
      <div className="sidebar-bottom"><button><Settings size={19}/>Configurações</button><div className="profile"><div className="avatar">PR</div><div><strong>Minha casa</strong><small>Plano pessoal</small></div><MoreHorizontal size={18}/></div></div>
    </aside>
    {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
    <main>
      <header><button className="menu-btn" onClick={() => setMenuOpen(true)}><Menu/></button><div className="mobile-title">conta<span>clara</span></div><div className="header-actions"><div className="sync-dot" title={finance.remote ? 'Sincronizado com Supabase' : 'Dados salvos neste dispositivo'}>{finance.remote ? 'Supabase' : 'Local'}</div><button className="icon-button"><Bell size={19}/><i/></button></div></header>
      {page === 'home' && <Dashboard finance={finance} current={current} offset={monthOffset} setOffset={setMonthOffset} openModal={setModal}/>} 
      {page === 'people' && <People finance={finance} openModal={setModal}/>} 
      {page === 'bills' && <Bills finance={finance} openModal={setModal}/>} 
    </main>
    {modal === 'person' && <PersonModal onClose={() => setModal(null)} onSave={person => { finance.addPerson(person); setModal(null) }}/>} 
    {modal === 'bill' && <BillModal people={finance.people} onClose={() => setModal(null)} onSave={bill => { finance.addBill(bill); setModal(null) }}/>} 
  </div>
}

function Dashboard({ finance, current, offset, setOffset, openModal }) {
  const period = periodKey(current)
  const bills = finance.bills.map(b => ({ ...b, status: finance.getStatus(b, period) }))
  const income = finance.people.reduce((sum, p) => sum + p.salary, 0)
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
      <Metric label="Receitas do mês" value={money(income)} icon={<TrendingUp/>} tint="purple" detail={`${finance.people.length} fonte${finance.people.length !== 1 ? 's' : ''} de renda`}/>
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
    <article className="panel projection"><div className="panel-head"><div><h2>Projeção dos próximos meses</h2><p>Estimativa baseada nas receitas e contas recorrentes cadastradas</p></div></div><div className="projection-bars">{[0,1,2,3,4,5].map(i => { const d = new Date(today.getFullYear(), today.getMonth()+i, 1); const future = balance * (i+1); return <div className="bar-col" key={i}><div className="bar-value">{money(future)}</div><div className="bar-track"><span style={{height: `${Math.max(22, Math.min(100, 22 + i*14))}%`}}/></div><small>{months[d.getMonth()].slice(0,3)}</small></div>})}</div></article>
  </section>
}

function Metric({ label, value, icon, tint, detail }) { return <article className="metric"><div className={`metric-icon ${tint}`}>{icon}</div><p>{label}</p><h2>{value}</h2><small>{detail}</small></article> }
function BillRow({ bill, person, onToggle }) { return <div className="bill-row"><button aria-label="Marcar pagamento" onClick={onToggle} className={bill.status === 'paid' ? 'check paid' : 'check'}>{bill.status === 'paid' && '✓'}</button><div className="due-date"><b>{String(bill.dueDay).padStart(2,'0')}</b><span>{today.toLocaleDateString('pt-BR', {month:'short'}).replace('.','')}</span></div><div className="bill-info"><strong>{bill.name}</strong><span>{bill.category} {person ? `· ${person.name}` : ''}</span></div><strong className={bill.status === 'paid' ? 'paid-value' : ''}>{money(bill.value)}</strong><span className={bill.status === 'paid' ? 'status paid-status' : 'status'}>{bill.status === 'paid' ? 'Pago' : 'Pendente'}</span></div> }
function Empty({ text }) { return <div className="empty">{text}</div> }

function People({ finance, openModal }) { return <section className="content"><div className="page-title"><div><p className="eyebrow">CADASTROS</p><h1>Pessoas e receitas</h1><p className="sub">Cadastre quem contribui para o orçamento da casa.</p></div><button className="primary" onClick={() => openModal('person')}><Plus size={18}/>Nova pessoa</button></div><div className="info-strip"><Users size={20}/><span>As receitas cadastradas aparecem automaticamente nas projeções mensais.</span></div><div className="person-grid">{finance.people.map(p => <article className="person-card" key={p.id}><div className="person-card-top"><div className="person-avatar" style={{background:p.color}}>{p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><button className="delete" onClick={() => finance.remove('people', p.id)}><Trash2 size={17}/></button></div><h2>{p.name}</h2><p>Recebe todo dia {p.payDay}</p><div className="salary"><span>Salário mensal</span><strong>{money(p.salary)}</strong></div></article>)}{finance.people.length === 0 && <Empty text="Cadastre a primeira pessoa para começar."/>}</div></section> }

function Bills({ finance, openModal }) {
  const [filter, setFilter] = useState('Todos')
  const period = periodKey(today)
  const bills = finance.bills.map(b => ({ ...b, status: finance.getStatus(b, period) })).filter(b => filter === 'Todos' || b.type === filter)
  return <section className="content"><div className="page-title"><div><p className="eyebrow">LANÇAMENTOS</p><h1>Contas e dívidas</h1><p className="sub">Registre suas despesas fixas e os valores que variam a cada mês.</p></div><button className="primary" onClick={() => openModal('bill')}><Plus size={18}/>Novo lançamento</button></div><div className="filters">{['Todos','Fixa','Flutuante'].map(item => <button key={item} onClick={() => setFilter(item)} className={filter === item ? 'selected' : ''}>{item === 'Todos' ? 'Todos os lançamentos' : `${item}s`}</button>)}</div><article className="panel table-panel"><div className="table-head"><span>DESCRIÇÃO</span><span>TIPO</span><span>VENCIMENTO</span><span>RESPONSÁVEL</span><span>VALOR</span><span>STATUS</span><span/></div>{bills.map(b => { const p=finance.people.find(x=>x.id===b.responsible); return <div className="table-row" key={b.id}><div><b>{b.name}</b><small>{b.category}</small></div><span className={`tag ${b.type === 'Fixa' ? 'fixed' : 'variable'}`}>{b.type}</span><span>Dia {b.dueDay}</span><span>{p?.name || '—'}</span><strong>{money(b.value)}</strong><button className={b.status === 'paid' ? 'status paid-status clickable' : 'status clickable'} onClick={() => finance.toggleBill(b, period)}>{b.status === 'paid' ? 'Pago' : 'Pendente'}</button><button className="delete" onClick={() => finance.remove('bills', b.id)}><Trash2 size={16}/></button></div>})}{bills.length === 0 && <Empty text="Nenhum lançamento neste filtro."/>}</article></section>
}

function Modal({ title, children, onClose }) { return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={20}/></button></div>{children}</div></div> }
function PersonModal({ onClose, onSave }) { const [form,setForm]=useState({name:'',salary:'',payDay:'5',color:'#7067cf'}); const submit=e=>{e.preventDefault(); if (!form.name || !form.salary) return; onSave({ ...form, id: crypto.randomUUID(), salary:Number(form.salary), payDay:Number(form.payDay) })}; return <Modal title="Nova pessoa" onClose={onClose}><form onSubmit={submit}><label>Nome<input autoFocus required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex.: Maria Silva"/></label><div className="form-row"><label>Salário mensal<input required min="0" step="0.01" type="number" value={form.salary} onChange={e=>setForm({...form,salary:e.target.value})} placeholder="0,00"/></label><label>Dia de recebimento<input required min="1" max="31" type="number" value={form.payDay} onChange={e=>setForm({...form,payDay:e.target.value})}/></label></div><label>Cor de identificação<input className="color-input" type="color" value={form.color} onChange={e=>setForm({...form,color:e.target.value})}/></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">Salvar pessoa</button></div></form></Modal> }
function BillModal({ people, onClose, onSave }) { const [form,setForm]=useState({name:'',value:'',dueDay:'10',type:'Fixa',category:'Casa',responsible:people[0]?.id || ''}); const submit=e=>{e.preventDefault(); if(!form.name || !form.value) return; onSave({...form,id:crypto.randomUUID(),value:Number(form.value),dueDay:Number(form.dueDay),status:'pending'})}; return <Modal title="Novo lançamento" onClose={onClose}><form onSubmit={submit}><label>Descrição<input autoFocus required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex.: Conta de água"/></label><div className="form-row"><label>Valor<input required min="0" step="0.01" type="number" value={form.value} onChange={e=>setForm({...form,value:e.target.value})} placeholder="0,00"/></label><label>Vencimento<input required min="1" max="31" type="number" value={form.dueDay} onChange={e=>setForm({...form,dueDay:e.target.value})}/></label></div><div className="form-row"><label>Tipo<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>Fixa</option><option>Flutuante</option></select></label><label>Categoria<input value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label></div><label>Responsável<select value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})}><option value="">Não definido</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">Salvar lançamento</button></div></form></Modal> }

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
createRoot(document.getElementById('root')).render(<App />)
