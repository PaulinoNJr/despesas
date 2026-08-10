import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import { Bell, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, CreditCard, Database, Download, Fingerprint, FolderCog, History, Home, KeyRound, LayoutList, LockKeyhole, LogOut, Mail, Menu, MoreHorizontal, Pencil, Plus, Settings, ShieldCheck, Tags, Trash2, TrendingDown, TrendingUp, UserPlus, Users, WalletCards, X } from 'lucide-react'
import { parseCreditCardInvoicePdf } from './card-invoice-parser'
import './styles.css'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const money = value => currency.format(Number(value || 0))
const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const today = new Date()
const dateLabel = date => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00`))
const periodKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const periodDate = period => {
  const [year, month] = period.split('-').map(Number)
  return new Date(year, month - 1, 1)
}
const isBillActiveInPeriod = (bill, period) => {
  // Lançamentos antigos e aqueles sem número de parcelas continuam recorrentes.
  if (!bill.installments || !bill.startPeriod) return true
  const start = periodDate(bill.startPeriod)
  const target = periodDate(period)
  const monthsSinceStart = (target.getFullYear() - start.getFullYear()) * 12 + target.getMonth() - start.getMonth()
  return monthsSinceStart >= 0 && monthsSinceStart < bill.installments
}
const isPayable = bill => bill.flow !== 'receivable'
const isCreditCardBill = bill => Boolean(bill.isCreditCard)
const dueDayForMonth = (date, dueDay) => Math.min(dueDay, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate())
const buildNotifications = finance => {
  const notifications = []
  const currentPeriod = periodKey(today)
  const recurringIncome = finance.incomes.reduce((sum, item) => sum + item.value, 0)
  const currentBills = finance.bills.filter(bill => isBillActiveInPeriod(bill, currentPeriod))
  const currentIncome = recurringIncome + currentBills.filter(bill => !isPayable(bill)).reduce((sum, bill) => sum + bill.value, 0)
  const currentExpenses = currentBills.filter(isPayable).reduce((sum, bill) => sum + bill.value, 0)
  const overdue = currentBills.filter(bill => isPayable(bill) && finance.getStatus(bill, currentPeriod) !== 'paid' && dueDayForMonth(today, bill.dueDay) < today.getDate())

  if (overdue.length) notifications.push({ id: `overdue:${currentPeriod}`, tone: 'danger', title: `${overdue.length} conta${overdue.length > 1 ? 's' : ''} em atraso`, text: `${money(overdue.reduce((sum, bill) => sum + bill.value, 0))} ainda precisa ser pago neste mês.` })

  for (let offset = 0; offset <= 3; offset += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
    const period = periodKey(date)
    finance.bills.filter(bill => isBillActiveInPeriod(bill, period) && finance.getStatus(bill, period) !== 'paid' && dueDayForMonth(date, bill.dueDay) === date.getDate()).forEach(bill => {
      const when = offset === 0 ? 'vence hoje' : offset === 1 ? 'vence amanhã' : `vence em ${offset} dias`
      const receivable = !isPayable(bill)
      notifications.push({ id: `due:${bill.id}:${period}`, tone: receivable ? 'good' : offset === 0 ? 'danger' : 'warning', title: receivable ? `${bill.name} entra ${offset === 0 ? 'hoje' : offset === 1 ? 'amanhã' : `em ${offset} dias`}` : `${bill.name} ${when}`, text: `${receivable ? 'Entrada prevista de' : 'Conta de'} ${money(bill.value)} · vencimento em ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}.` })
    })
  }

  if (currentIncome > 0 && currentExpenses > currentIncome) notifications.push({ id: `budget:over:${currentPeriod}`, tone: 'danger', title: 'Orçamento ultrapassado', text: `As contas somam ${money(currentExpenses - currentIncome)} a mais que suas receitas deste mês.` })
  else if (currentIncome > 0 && currentExpenses / currentIncome >= 0.8) notifications.push({ id: `budget:attention:${currentPeriod}`, tone: 'warning', title: 'Orçamento quase no limite', text: `${Math.round((currentExpenses / currentIncome) * 100)}% das receitas deste mês já estão comprometidas.` })

  currentBills.filter(bill => bill.installments && bill.startPeriod).forEach(bill => {
    const start = periodDate(bill.startPeriod)
    const monthsSinceStart = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth()
    if (monthsSinceStart === bill.installments - 1) notifications.push({ id: `last-installment:${bill.id}:${currentPeriod}`, tone: 'good', title: 'Última parcela chegou', text: isPayable(bill) ? `${bill.name} sai do seu orçamento a partir do próximo mês.` : `${bill.name} deixa de entrar nas receitas a partir do próximo mês.` })
  })

  return notifications
}

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
  categories: [{ id: 'c1', name: 'Moradia', color: '#7067cf' }, { id: 'c2', name: 'Casa', color: '#4caf88' }, { id: 'c3', name: 'Financeiro', color: '#e9785f' }, { id: 'c4', name: 'Pessoal', color: '#e0aa45' }],
  types: [{ id: 't1', name: 'Fixa' }, { id: 't2', name: 'Flutuante' }],
  bills: [
    { id: 'b1', name: 'Aluguel', value: 1450, dueDay: 8, type: 'Fixa', category: 'Moradia', responsible: 'p1', status: 'pending' },
    { id: 'b2', name: 'Energia elétrica', value: 180, dueDay: 10, type: 'Flutuante', category: 'Casa', responsible: 'p1', status: 'pending' },
    { id: 'b3', name: 'Internet', value: 119.9, dueDay: 12, type: 'Fixa', category: 'Casa', responsible: 'p2', status: 'paid' },
    { id: 'b4', name: 'Cartão de crédito', value: 780, dueDay: 15, type: 'Flutuante', category: 'Financeiro', responsible: 'p1', status: 'pending', isCreditCard: true, cardName: 'Cartão de crédito' },
    { id: 'b5', name: 'Academia', value: 99.9, dueDay: 20, type: 'Fixa', category: 'Pessoal', responsible: 'p2', status: 'pending' },
  ]
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, { auth: { experimental: { passkey: true } } }) : null

function useFinance() {
  const [data, setData] = useState(() => {
    if (supabase) return { people: [], incomes: [], categories: [], types: [], bills: [], payments: {}, logs: [] }
    try {
      const saved = JSON.parse(localStorage.getItem('conta-clara-data'))
      return saved ? { ...saved, payments: saved.payments || {}, logs: saved.logs || [], incomes: saved.incomes || [], categories: saved.categories || seed.categories, types: saved.types || seed.types } : { ...seed, payments: {}, logs: [] }
    } catch { return { ...seed, payments: {}, logs: [] } }
  })
  const [remote, setRemote] = useState(false)
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [connectionError, setConnectionError] = useState('')
  const [family, setFamily] = useState({ members: [], invites: [] })
  const [invoices, setInvoices] = useState([])
  const [preferences, setPreferences] = useState(() => {
    try { return { projectionMonths: 6, ...JSON.parse(localStorage.getItem('conta-clara-preferences')) } } catch { return { projectionMonths: 6 } }
  })

  useEffect(() => {
    if (!supabase) return
    let active = true
    const load = async () => {
      const [people, bills, payments, incomes, categoryResult, typeResult, auditLogs, invoiceResult] = await Promise.all([supabase.from('people').select('*').order('created_at'), supabase.from('bills').select('*').order('due_day'), supabase.from('bill_payments').select('*'), supabase.from('income_payments').select('*').order('pay_day'), supabase.from('expense_categories').select('*').order('name'), supabase.from('expense_types').select('*').order('name'), supabase.from('audit_logs').select('*').order('created_at', { ascending: false }), supabase.from('credit_card_invoices').select('*').order('created_at', { ascending: false })])
      if (active && !people.error && !bills.error && !payments.error && !incomes.error && !categoryResult.error && !typeResult.error && !auditLogs.error && !invoiceResult.error) {
        let categories = categoryResult.data.map(category => ({ id: category.id, name: category.name, color: category.color }))
        let types = typeResult.data.map(type => ({ id: type.id, name: type.name }))
        if (categories.length === 0) { categories = seed.categories.map(category => ({ ...category, id: crypto.randomUUID() })); await supabase.from('expense_categories').insert(categories) }
        if (types.length === 0) { types = seed.types.map(type => ({ ...type, id: crypto.randomUUID() })); await supabase.from('expense_types').insert(types) }
        const paymentMap = Object.fromEntries(payments.data.filter(p => p.status === 'paid').map(p => [`${p.bill_id}:${p.period}`, 'paid']))
        setData({ people: people.data.map(p => ({ id: p.id, name: p.name, color: p.color })), incomes: incomes.data.map(i => ({ id: i.id, personId: i.person_id, value: Number(i.value), payDay: i.pay_day })), categories, types, bills: bills.data.map(b => ({ id: b.id, name: b.name, value: Number(b.value), dueDay: b.due_day, type: b.type, category: b.category, responsible: b.responsible, installments: b.installments, startPeriod: b.start_period, flow: b.flow || 'payable', isCreditCard: b.is_credit_card || false, cardName: b.card_name || '', cardInvoiceId: b.card_invoice_id || null })), payments: paymentMap, logs: auditLogs.data.map(log => ({ id: log.id, entityId: log.entity_id, action: log.action, changes: log.changes, createdAt: log.created_at })) })
        setInvoices(invoiceResult.data.map(invoice => ({ id: invoice.id, familyId: invoice.family_id, cardName: invoice.card_name, invoiceKey: invoice.invoice_key, statementTotal: Number(invoice.statement_total), dueDate: invoice.due_date, sourceFileName: invoice.source_file_name })))
        setRemote(true)
        setConnectionError('')
        await loadFamily()
      } else if (active) {
        setConnectionError(people.error?.message || bills.error?.message || payments.error?.message || incomes.error?.message || categoryResult.error?.message || typeResult.error?.message || auditLogs.error?.message || invoiceResult.error?.message || 'Não foi possível acessar o banco.')
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
      else { setRemote(false); setData({ people: [], incomes: [], categories: [], types: [], bills: [], payments: {}, logs: [] }); setFamily({ members: [], invites: [] }); setInvoices([]) }
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
  const signInWithPasskey = async () => {
    if (!supabase?.auth.signInWithPasskey) return 'Passkeys não estão disponíveis. Atualize o app e ative o recurso no Supabase.'
    const { error } = await supabase.auth.signInWithPasskey()
    return error?.message || ''
  }
  const registerPasskey = async () => {
    if (!supabase?.auth.registerPasskey) return { error: 'Passkeys não estão disponíveis. Atualize o app e ative o recurso no Supabase.' }
    const { data, error } = await supabase.auth.registerPasskey()
    return { data, error: error?.message || '' }
  }
  const listPasskeys = async () => {
    if (!supabase?.auth.passkey?.list) return { data: [], error: 'Passkeys não estão disponíveis.' }
    const { data, error } = await supabase.auth.passkey.list()
    return { data: data || [], error: error?.message || '' }
  }
  const removePasskey = async passkeyId => {
    if (!supabase?.auth.passkey?.delete) return 'Passkeys não estão disponíveis.'
    const { error } = await supabase.auth.passkey.delete({ passkeyId })
    return error?.message || ''
  }
  const changePassword = async (currentPassword, password) => {
    if (!supabase) return 'A conexão com o Supabase não está configurada.'
    const { error } = await supabase.auth.updateUser({ password, current_password: currentPassword })
    return error?.message || ''
  }
  const updateDisplayName = async displayName => {
    if (!supabase) return 'A conexão com o Supabase não está configurada.'
    const { data, error } = await supabase.auth.updateUser({ data: { display_name: displayName } })
    if (!error && data.user) setUser(data.user)
    return error?.message || ''
  }
  const updatePreferences = updates => {
    const next = { ...preferences, ...updates }
    setPreferences(next)
    localStorage.setItem('conta-clara-preferences', JSON.stringify(next))
  }
  const loadFamily = async () => {
    if (!supabase) return
    const [members, invites] = await Promise.all([
      supabase.from('family_members').select('family_id, user_id, email, joined_at').order('joined_at'),
      supabase.from('family_invites').select('id, email, token, status, expires_at, created_at').eq('status', 'pending').order('created_at', { ascending: false })
    ])
    if (!members.error && !invites.error) setFamily({ members: members.data || [], invites: invites.data || [] })
  }
  const inviteFamilyMember = async email => {
    if (!supabase) return 'A conexÃ£o com o Supabase nÃ£o estÃ¡ configurada.'
    const redirectTo = new URL(window.location.origin)
    const { data, error } = await supabase.functions.invoke('invite-family-member', { body: { email, redirectTo: redirectTo.toString() } })
    if (error) return error.message || 'NÃ£o foi possÃ­vel enviar o convite.'
    if (data?.token) {
      redirectTo.searchParams.set('family-invite', data.token)
      if (data.existingUser) {
        const { error: magicLinkError } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo.toString(), shouldCreateUser: false } })
        if (magicLinkError) return magicLinkError.message || 'NÃ£o foi possÃ­vel confirmar o e-mail do familiar.'
      }
      await loadFamily()
      return ''
    }
    return 'O convite nÃ£o retornou uma confirmaÃ§Ã£o vÃ¡lida.'
  }
  const cancelFamilyInvite = async id => {
    if (!supabase) return ''
    const { error } = await supabase.rpc('cancel_family_invitation', { p_id: id })
    if (!error) await loadFamily()
    return error?.message || ''
  }
  const getFamilyInvitation = async token => {
    if (!supabase || !token) return { data: null, error: '' }
    const { data, error } = await supabase.rpc('get_family_invitation', { p_token: token })
    return { data: data?.[0] || null, error: error?.message || '' }
  }
  const acceptFamilyInvitation = async token => {
    if (!supabase) return 'A conexÃ£o com o Supabase nÃ£o estÃ¡ configurada.'
    const { error } = await supabase.rpc('accept_family_invitation', { p_token: token })
    if (!error) { await loadFamily(); window.history.replaceState({}, '', window.location.pathname) }
    return error?.message || ''
  }

  const save = async (next, operation) => {
    setData(next)
    if (!supabase) localStorage.setItem('conta-clara-data', JSON.stringify(next))
    if (!supabase || !operation) return
    const { table, action, payload, id } = operation
    if (action === 'insert') await supabase.from(table).insert(payload)
    if (action === 'update') await supabase.from(table).update(payload).eq('id', id)
    if (action === 'delete') await supabase.from(table).delete().eq('id', id)
  }
  const addPerson = async person => {
    const next = { ...data, people: [...data.people, person], incomes: [...data.incomes, ...person.incomes] }
    setData(next)
    if (!supabase) localStorage.setItem('conta-clara-data', JSON.stringify(next))
    if (!supabase) return
    const total = person.incomes.reduce((sum, income) => sum + income.value, 0)
    await supabase.from('people').insert({ id: person.id, name: person.name, salary: total, pay_day: person.incomes[0].payDay, color: person.color })
    await supabase.from('income_payments').insert(person.incomes.map(income => ({ id: income.id, person_id: person.id, value: income.value, pay_day: income.payDay })))
  }
  const addIncome = async income => {
    const next = { ...data, incomes: [...data.incomes, income] }
    setData(next)
    if (!supabase) localStorage.setItem('conta-clara-data', JSON.stringify(next))
    if (supabase) await supabase.from('income_payments').insert({ id: income.id, person_id: income.personId, value: income.value, pay_day: income.payDay })
  }
  const addCategory = category => save({ ...data, categories: [...data.categories, category] }, { table: 'expense_categories', action: 'insert', payload: category })
  const addType = type => save({ ...data, types: [...data.types, type] }, { table: 'expense_types', action: 'insert', payload: type })
  const addBill = bill => save({ ...data, bills: [...data.bills, bill] }, { table: 'bills', action: 'insert', payload: { id: bill.id, name: bill.name, value: bill.value, due_day: bill.dueDay, type: bill.type, category: bill.category, responsible: bill.responsible, installments: bill.installments || null, start_period: bill.startPeriod || null, flow: bill.flow || 'payable', is_credit_card: Boolean(bill.isCreditCard), card_name: bill.isCreditCard ? bill.cardName : null, card_invoice_id: bill.cardInvoiceId || null } })
  const updateBill = async bill => {
    const existingBill = data.bills.find(item => item.id === bill.id)
    if (!existingBill) return
    const before = { ...existingBill, flow: existingBill.flow || 'payable', installments: existingBill.installments || null, startPeriod: existingBill.startPeriod || null, isCreditCard: Boolean(existingBill.isCreditCard), cardName: existingBill.cardName || '' }
    const updatedBill = { ...bill, flow: bill.flow || 'payable', isCreditCard: Boolean(bill.isCreditCard), cardName: bill.isCreditCard ? bill.cardName : '' }
    const log = { id: crypto.randomUUID(), entityId: bill.id, action: 'updated', changes: { before, after: updatedBill }, createdAt: new Date().toISOString() }
    const next = { ...data, bills: data.bills.map(item => item.id === bill.id ? updatedBill : item), logs: [log, ...(data.logs || [])] }
    setData(next)
    if (!supabase) { localStorage.setItem('conta-clara-data', JSON.stringify(next)); return }
    const payload = { name: updatedBill.name, value: updatedBill.value, due_day: updatedBill.dueDay, type: updatedBill.type, category: updatedBill.category, responsible: updatedBill.responsible, installments: updatedBill.installments || null, start_period: updatedBill.startPeriod || null, flow: updatedBill.flow, is_credit_card: updatedBill.isCreditCard, card_name: updatedBill.cardName || null, card_invoice_id: updatedBill.cardInvoiceId || null }
    await Promise.all([supabase.from('bills').update(payload).eq('id', bill.id), supabase.from('audit_logs').insert({ id: log.id, entity_id: log.entityId, action: log.action, changes: log.changes, created_at: log.createdAt })])
  }
  const getStatus = (bill, period) => data.payments?.[`${bill.id}:${period}`] || 'pending'
  const toggleBill = async (bill, period) => {
    const key = `${bill.id}:${period}`
    const wasPaid = getStatus(bill, period) === 'paid'
    const payments = { ...data.payments }
    if (wasPaid) delete payments[key]; else payments[key] = 'paid'
    const next = { ...data, payments }
    setData(next)
    if (!supabase) localStorage.setItem('conta-clara-data', JSON.stringify(next))
    if (!supabase) return
    if (wasPaid) await supabase.from('bill_payments').delete().eq('bill_id', bill.id).eq('period', period)
    else await supabase.from('bill_payments').upsert({ bill_id: bill.id, period, status: 'paid' }, { onConflict: 'bill_id,period' })
  }
  const remove = (kind, id) => {
    const next = { ...data, [kind]: data[kind].filter(item => item.id !== id), ...(kind === 'people' ? { incomes: data.incomes.filter(income => income.personId !== id) } : {}) }
    const table = { people: 'people', incomes: 'income_payments', categories: 'expense_categories', types: 'expense_types', bills: 'bills' }[kind]
    return save(next, { table, action: 'delete', id })
  }
  const importCardInvoice = async ({ invoice, bills }) => {
    if (invoices.some(item => item.invoiceKey === invoice.invoiceKey)) return 'Esta fatura já foi importada nesta família.'
    const nextBills = bills.map(bill => ({ ...bill, cardInvoiceId: invoice.id }))
    if (!supabase) {
      const next = { ...data, bills: [...data.bills, ...nextBills] }
      setData(next)
      setInvoices([invoice, ...invoices])
      localStorage.setItem('conta-clara-data', JSON.stringify(next))
      return ''
    }
    const familyId = family.members.find(member => member.user_id === user?.id)?.family_id
    if (!familyId) return 'Não foi possível identificar a família para esta fatura.'
    const { error: invoiceError } = await supabase.from('credit_card_invoices').insert({ id: invoice.id, family_id: familyId, card_name: invoice.cardName, invoice_key: invoice.invoiceKey, statement_total: invoice.statementTotal, due_date: invoice.dueDate, source_file_name: invoice.sourceFileName })
    if (invoiceError) return invoiceError.message || 'Não foi possível registrar a fatura.'
    const payload = nextBills.map(bill => ({ id: bill.id, name: bill.name, value: bill.value, due_day: bill.dueDay, type: bill.type, category: bill.category, responsible: bill.responsible || null, installments: bill.installments || null, start_period: bill.startPeriod || null, flow: 'payable', is_credit_card: true, card_name: bill.cardName, card_invoice_id: invoice.id }))
    const { error: billsError } = await supabase.from('bills').insert(payload)
    if (billsError) { await supabase.from('credit_card_invoices').delete().eq('id', invoice.id); return billsError.message || 'Não foi possível salvar os lançamentos da fatura.' }
    setData({ ...data, bills: [...data.bills, ...nextBills] })
    setInvoices([invoice, ...invoices])
    return ''
  }
  return { ...data, invoices, family, remote, user, authReady, connectionError, preferences, signIn, signInWithPasskey, signOut, registerPasskey, listPasskeys, removePasskey, changePassword, updateDisplayName, updatePreferences, inviteFamilyMember, cancelFamilyInvite, getFamilyInvitation, acceptFamilyInvitation, addPerson, addIncome, addCategory, addType, addBill, updateBill, importCardInvoice, toggleBill, getStatus, remove }
}

function LoadingPage() {
  return <div className="auth-page"><div className="auth-card loading-card"><span className="brand-mark"><CircleDollarSign size={26}/></span><h1>Conta Certa</h1><p>Verificando sua sessão…</p><div className="loader"/></div></div>
}

function LoginPage({ onLogin, onPasskeyLogin, missingConfig, connectionError }) {
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
  const passkeyLogin = async () => {
    if (!onPasskeyLogin) return
    setError('')
    setLoading(true)
    const message = await onPasskeyLogin()
    setLoading(false)
    if (message) setError(message)
  }
  return <div className="auth-page"><div className="auth-orb orb-one"/><div className="auth-orb orb-two"/><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><CircleDollarSign size={26}/></span><span>Conta <span>Certa</span></span></div>{missingConfig ? <><h1>Configuração necessária</h1><p>Adicione as variáveis do Supabase na Vercel para liberar o acesso.</p></> : <><div className="lock-circle"><LockKeyhole size={21}/></div><p className="eyebrow">ÁREA RESTRITA</p><h1>Bem-vindo de volta</h1><p>Entre para acompanhar as contas da sua casa.</p><form onSubmit={submit}><label>E-mail<input autoFocus type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@email.com"/></label><label>Senha<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Sua senha"/></label>{(error || connectionError) && <div className="login-error">{error || connectionError}</div>}<button className="primary login-submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar na conta'}</button>{onPasskeyLogin && <button type="button" className="secondary passkey-login" onClick={passkeyLogin} disabled={loading}><Fingerprint size={16}/>Entrar com Face ID ou digital</button>}</form><small className="auth-hint">Seu acesso é criado pelo administrador da aplicação.</small></>}</section></div>
}

function App() {
  const finance = useFinance()
  const [page, setPage] = useState('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [monthOffset, setMonthOffset] = useState(0)
  const [modal, setModal] = useState(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [readNotifications, setReadNotifications] = useState([])
  const [familyInvitationToken, setFamilyInvitationToken] = useState(() => new URLSearchParams(window.location.search).get('family-invite'))
  const notificationRef = useRef(null)
  const profileMenuRef = useRef(null)
  const current = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const displayName = finance.user?.user_metadata?.display_name || finance.user?.email?.split('@')[0] || 'você'
  const notificationStorageKey = `conta-clara-read-notifications-${finance.user?.id || 'local'}`
  const notifications = useMemo(() => buildNotifications(finance), [finance])
  const unreadCount = notifications.filter(notification => !readNotifications.includes(notification.id)).length
  useEffect(() => {
    try { setReadNotifications(JSON.parse(localStorage.getItem(notificationStorageKey)) || []) } catch { setReadNotifications([]) }
  }, [notificationStorageKey])
  useEffect(() => {
    const closeOnOutsideClick = event => {
      if (notificationsOpen && !notificationRef.current?.contains(event.target)) setNotificationsOpen(false)
      if (profileMenuOpen && !profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [notificationsOpen, profileMenuOpen])
  useEffect(() => {
    if (familyInvitationToken && finance.user) setPage('settings')
  }, [familyInvitationToken, finance.user])
  const markNotificationAsRead = id => setReadNotifications(currentRead => {
    if (currentRead.includes(id)) return currentRead
    const nextRead = [...currentRead, id]
    localStorage.setItem(notificationStorageKey, JSON.stringify(nextRead))
    return nextRead
  })
  const markAllNotificationsAsRead = () => {
    const nextRead = Array.from(new Set([...readNotifications, ...notifications.map(notification => notification.id)]))
    setReadNotifications(nextRead)
    localStorage.setItem(notificationStorageKey, JSON.stringify(nextRead))
  }
  const navigate = target => { setPage(target); setMenuOpen(false) }
  const nav = [{ id: 'home', label: 'Visão geral', icon: Home }, { id: 'people', label: 'Cadastros', icon: Users }, { id: 'bills', label: 'Lançamentos', icon: LayoutList }, { id: 'cards', label: 'Cartão de crédito', icon: CreditCard }, { id: 'categories', label: 'Categorias e tipos', icon: Tags }, { id: 'logs', label: 'Histórico', icon: History }]

  if (!supabase) return <LoginPage missingConfig />
  if (!finance.authReady) return <LoadingPage />
  if (!finance.user) return <LoginPage onLogin={finance.signIn} onPasskeyLogin={finance.signInWithPasskey} connectionError={finance.connectionError}/>

  return <div className="app-shell">
    <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><span className="brand-mark"><CircleDollarSign size={23}/></span><span>Conta <span>Certa</span></span><button className="mobile-close" onClick={() => setMenuOpen(false)}><X size={20}/></button></div>
      <nav>{nav.map(item => <button key={item.id} onClick={() => navigate(item.id)} className={page === item.id ? 'active' : ''}><item.icon size={19}/>{item.label}</button>)}</nav>
      <div className="sidebar-bottom"><button onClick={() => navigate('settings')} className={page === 'settings' ? 'active' : ''}><Settings size={19}/>Configurações</button><div className="profile"><div className="avatar">{displayName.slice(0,2).toUpperCase()}</div><div><strong>{displayName}</strong><small>{finance.user.email}</small></div><div className="profile-menu-wrap" ref={profileMenuRef}><button className="profile-more" title="Opções da conta" onClick={() => setProfileMenuOpen(!profileMenuOpen)}><MoreHorizontal size={18}/></button>{profileMenuOpen && <div className="profile-popover"><button onClick={() => { setProfileMenuOpen(false); finance.signOut() }}><LogOut size={16}/>Sair da conta</button></div>}</div></div></div>
    </aside>
    {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
    <main>
      <header><button className="menu-btn" onClick={() => setMenuOpen(true)}><Menu/></button><div className="mobile-title">Conta <span>Certa</span></div><div className="header-actions"><div className="notification-wrap" ref={notificationRef}><button className="icon-button" title={unreadCount ? `${unreadCount} nova${unreadCount > 1 ? 's' : ''} mensagem${unreadCount > 1 ? 's' : ''}` : 'Notificações'} aria-label="Abrir notificações" onClick={() => setNotificationsOpen(open => !open)}><Bell size={19}/>{unreadCount > 0 && <i/>}</button>{notificationsOpen && <NotificationPanel notifications={notifications} readNotifications={readNotifications} onRead={markNotificationAsRead} onReadAll={markAllNotificationsAsRead}/>}</div></div></header>
      {page === 'home' && <Dashboard finance={finance} displayName={displayName} current={current} offset={monthOffset} setOffset={setMonthOffset} openModal={setModal}/>}
      {page === 'people' && <People finance={finance} openModal={setModal}/>}
      {page === 'bills' && <Bills finance={finance} openModal={setModal}/>}
      {page === 'cards' && <CreditCardBills finance={finance} openModal={setModal}/>}
      {page === 'categories' && <CategoriesPage finance={finance} openModal={setModal}/>}
      {page === 'logs' && <AuditLogs finance={finance}/>}
      {page === 'settings' && <SettingsPage finance={finance}/>}
    </main>
    {modal === 'person' && <PersonModal onClose={() => setModal(null)} onSave={person => { finance.addPerson(person); setModal(null) }}/>}
    {modal === 'bill' && (
      <BillModal
        people={finance.people}
        categories={finance.categories}
        types={finance.types}
        initialPeriod={periodKey(current)}
        onClose={() => setModal(null)}
        onSave={bill => { finance.addBill(bill); setModal(null) }}
      />
    )}
    {modal?.type === 'edit-bill' && <BillModal people={finance.people} categories={finance.categories} types={finance.types} initialPeriod={periodKey(current)} initialBill={modal.bill} onClose={() => setModal(null)} onSave={bill => { finance.updateBill(bill); setModal(null) }} />}
    {modal === 'card-bill' && <BillModal people={finance.people} categories={finance.categories} types={finance.types} initialPeriod={periodKey(current)} forceCreditCard onClose={() => setModal(null)} onSave={bill => { finance.addBill(bill); setModal(null) }} />}
    {modal === 'import-card-invoice' && <CardInvoiceImportModal finance={finance} onClose={() => setModal(null)} />}
    {modal?.type === 'income' && <IncomeModal person={modal.person} onClose={() => setModal(null)} onSave={income => { finance.addIncome(income); setModal(null) }} />}
    {modal === 'category' && <CategoryModal onClose={() => setModal(null)} onSave={category => { finance.addCategory(category); setModal(null) }} />}
    {modal === 'type' && <TypeModal onClose={() => setModal(null)} onSave={type => { finance.addType(type); setModal(null) }} />}
    {familyInvitationToken && <FamilyInvitationModal token={familyInvitationToken} finance={finance} onClose={() => { window.history.replaceState({}, '', window.location.pathname); setFamilyInvitationToken(null) }} onAccepted={() => setFamilyInvitationToken(null) }/>}
  </div>
}

function NotificationPanel({ notifications, readNotifications, onRead, onReadAll }) {
  const unreadCount = notifications.filter(notification => !readNotifications.includes(notification.id)).length
  return <section className="notification-panel" aria-label="Notificações"><div className="notification-head"><div><strong>Notificações</strong><small>{unreadCount ? `${unreadCount} nova${unreadCount > 1 ? 's' : ''}` : 'Tudo lido'}</small></div>{unreadCount > 0 && <button type="button" onClick={onReadAll}>Marcar todas como lidas</button>}</div>{notifications.length ? <div className="notification-list">{notifications.map(notification => { const unread = !readNotifications.includes(notification.id); return <button type="button" key={notification.id} className={`notification-item ${unread ? 'unread' : 'read'}`} onClick={() => onRead(notification.id)}><span className={`notification-tone ${notification.tone}`}/><span><strong>{notification.title}</strong><small>{notification.text}</small></span>{unread && <i aria-label="Não lida"/>}</button> })}</div> : <div className="notification-empty"><strong>Nenhum alerta agora.</strong><span>Seu planejamento está em dia.</span></div>}</section>
}

function Dashboard({ finance, displayName, current, offset, setOffset, openModal }) {
  const period = periodKey(current)
  const bills = finance.bills.filter(bill => isBillActiveInPeriod(bill, period)).map(b => ({ ...b, status: finance.getStatus(b, period) }))
  const receivables = bills.filter(bill => !isPayable(bill))
  const payables = bills.filter(isPayable)
  const recurringIncome = finance.incomes.reduce((sum, item) => sum + item.value, 0)
  const income = recurringIncome + receivables.reduce((sum, bill) => sum + bill.value, 0)
  const expenses = payables.reduce((sum, bill) => sum + bill.value, 0)
  const paid = payables.filter(bill => bill.status === 'paid').reduce((sum, bill) => sum + bill.value, 0)
  const remaining = expenses - paid
  const balance = income - expenses
  const sorted = [...bills].sort((a,b) => a.dueDay - b.dueDay)
  const yearMonth = `${months[current.getMonth()]} ${current.getFullYear()}`
  let accumulatedBalance = 0
  const projection = Array.from({ length: finance.preferences.projectionMonths }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() + index, 1)
    const monthBills = finance.bills.filter(bill => isBillActiveInPeriod(bill, periodKey(date)))
    const monthIncome = recurringIncome + monthBills.filter(bill => !isPayable(bill)).reduce((sum, bill) => sum + bill.value, 0)
    const monthExpenses = monthBills.filter(isPayable).reduce((sum, bill) => sum + bill.value, 0)
    accumulatedBalance += monthIncome - monthExpenses
    return { date, value: accumulatedBalance }
  })
  const largestProjection = Math.max(...projection.map(item => Math.abs(item.value)), 1)
  return <section className="content">
    <div className="page-title"><div><p className="eyebrow">PLANEJAMENTO FINANCEIRO</p><h1>Olá, {displayName}! Veja como está seu mês.</h1><p className="sub">Acompanhe suas contas e mantenha tudo sob controle.</p></div><button className="primary" onClick={() => openModal('bill')}><Plus size={18}/>Novo lançamento</button></div>
    <div className="month-control"><button onClick={() => setOffset(offset - 1)}><ChevronLeft size={18}/></button><div><CalendarDays size={17}/>{yearMonth}</div><button onClick={() => setOffset(offset + 1)}><ChevronRight size={18}/></button></div>
    <div className="cards">
      <Metric label="Receitas do mês" value={money(income)} icon={<TrendingUp/>} tint="purple" detail={`${finance.incomes.length + receivables.length} conta${finance.incomes.length + receivables.length !== 1 ? 's' : ''} a receber`}/>
      <Metric label="Contas a pagar" value={money(expenses)} icon={<TrendingDown/>} tint="coral" detail={`${payables.length} lançamento${payables.length !== 1 ? 's' : ''} programado${payables.length !== 1 ? 's' : ''}`}/>
      <Metric label="Saldo projetado" value={money(balance)} icon={<WalletCards/>} tint={balance < 0 ? 'coral' : 'green'} detail={balance >= 0 ? 'Disponível após as contas' : 'Atenção: saldo negativo'}/>
    </div>
    <div className="dashboard-grid">
      <article className="panel upcoming"><div className="panel-head"><div><h2>Próximos vencimentos</h2><p>Veja pagamentos e recebimentos que estão por vir</p></div><button className="text-button" onClick={() => openModal('bill')}>Adicionar</button></div>
        <div className="bill-list">{sorted.slice(0,5).map(b => <BillRow key={b.id} bill={b} person={finance.people.find(p => p.id === b.responsible)} month={current} onToggle={() => finance.toggleBill(b, period)}/>)}</div>
        {sorted.length === 0 && <Empty text="Nenhuma conta cadastrada ainda."/>}
      </article>
      <article className="panel progress-panel"><div className="panel-head"><div><h2>Contas a pagar</h2><p>Você já pagou {money(paid)} em contas</p></div><span className="percentage">{expenses ? Math.round((paid/expenses)*100) : 0}%</span></div><div className="progress"><span style={{width: `${expenses ? Math.min((paid/expenses)*100, 100) : 0}%`}}/></div><div className="progress-label"><span>Pago</span><strong>{money(paid)}</strong></div><div className="progress-label"><span>Falta pagar</span><strong>{money(remaining)}</strong></div><hr/><div className="small-stats"><div><span>Contas pagas</span><b>{payables.filter(b=>b.status==='paid').length}</b></div><div><span>Pendentes</span><b>{payables.filter(b=>b.status!=='paid').length}</b></div></div></article>
    </div>
    <article className="panel projection"><div className="panel-head"><div><h2>Projeção dos próximos meses</h2><p>Saldo acumulado com receitas, contas recorrentes e parcelas ainda ativas.</p></div></div><div className="projection-bars">{projection.map(item => <div className="bar-col" key={periodKey(item.date)}><div className="bar-value">{money(item.value)}</div><div className="bar-track"><span className={item.value < 0 ? 'negative' : ''} style={{height: `${Math.max(8, Math.round((Math.abs(item.value) / largestProjection) * 100))}%`}}/></div><small>{months[item.date.getMonth()].slice(0,3)}</small></div>)}</div></article>
  </section>
}

function Metric({ label, value, icon, tint, detail }) { return <article className="metric"><div className={`metric-icon ${tint}`}>{icon}</div><p>{label}</p><h2>{value}</h2><small>{detail}</small></article> }
function BillRow({ bill, person, month, onToggle }) { const receivable = !isPayable(bill); return <div className="bill-row"><button aria-label={receivable ? 'Marcar recebimento' : 'Marcar pagamento'} onClick={onToggle} className={bill.status === 'paid' ? 'check paid' : 'check'} /><div className="due-date"><b>{String(bill.dueDay).padStart(2,'0')}</b><span>{month.toLocaleDateString('pt-BR', {month:'short'}).replace('.','')}</span></div><div className="bill-info"><strong>{bill.name}</strong><span>{receivable ? 'A receber' : 'A pagar'} · {bill.category} {person ? `· ${person.name}` : ''}</span></div><strong className={bill.status === 'paid' ? 'paid-value' : ''}>{money(bill.value)}</strong><span className={bill.status === 'paid' ? 'status paid-status' : 'status'}>{bill.status === 'paid' ? (receivable ? 'Recebido' : 'Pago') : 'Pendente'}</span></div> }
function Empty({ text }) { return <div className="empty">{text}</div> }

function People({ finance, openModal }) {
  return <section className="content"><div className="page-title"><div><p className="eyebrow">CADASTROS</p><h1>Pessoas e receitas</h1><p className="sub">Cadastre quem contribui para o orçamento da casa.</p></div><button className="primary" onClick={() => openModal('person')}><Plus size={18}/>Nova pessoa</button></div><div className="info-strip"><Users size={20}/><span>Inclua quantos recebimentos quiser para cada pessoa.</span></div><div className="person-grid">{finance.people.map(p => { const incomes = finance.incomes.filter(income => income.personId === p.id).sort((a,b) => a.payDay - b.payDay); const total = incomes.reduce((sum, income) => sum + income.value, 0); return <article className="person-card" key={p.id}><div className="person-card-top"><div className="person-avatar" style={{background:p.color}}>{p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><button className="delete" onClick={() => finance.remove('people', p.id)}><Trash2 size={17}/></button></div><h2>{p.name}</h2><div className="income-list">{incomes.map(income => <div key={income.id}><span>Dia {income.payDay}</span><b>{money(income.value)}</b><button className="delete income-delete" title="Remover pagamento" onClick={() => finance.remove('incomes', income.id)}><X size={13}/></button></div>)}</div><button className="add-income" onClick={() => openModal({ type: 'income', person: p })}><Plus size={14}/>Adicionar pagamento</button><div className="salary"><span>Total mensal</span><strong>{money(total)}</strong></div></article>})}{finance.people.length === 0 && <Empty text="Cadastre a primeira pessoa para começar."/>}</div></section>
}

function CategoriesPage({ finance, openModal }) {
  return <section className="content"><div className="page-title"><div><p className="eyebrow">ORGANIZAÇÃO</p><h1>Categorias e tipos</h1><p className="sub">Personalize como suas contas aparecem no planejamento.</p></div></div><div className="categories-grid"><article className="panel category-panel"><div className="panel-head"><div><h2>Categorias</h2><p>Classifique para onde o dinheiro vai.</p></div><button className="primary small-primary" onClick={() => openModal('category')}><Plus size={16}/>Nova categoria</button></div><div className="category-items">{finance.categories.map(category => <div className="category-item" key={category.id}><span className="category-color" style={{ background: category.color }}/><strong>{category.name}</strong><button className="delete" title="Excluir categoria" onClick={() => finance.remove('categories', category.id)}><Trash2 size={16}/></button></div>)}{finance.categories.length === 0 && <Empty text="Nenhuma categoria cadastrada."/>}</div></article><article className="panel category-panel"><div className="panel-head"><div><h2>Tipos de lançamento</h2><p>Defina se a despesa é fixa, variável ou outra.</p></div><button className="primary small-primary" onClick={() => openModal('type')}><Plus size={16}/>Novo tipo</button></div><div className="type-items">{finance.types.map(type => <div className="type-item" key={type.id}><FolderCog size={17}/><strong>{type.name}</strong><button className="delete" title="Excluir tipo" onClick={() => finance.remove('types', type.id)}><Trash2 size={16}/></button></div>)}{finance.types.length === 0 && <Empty text="Nenhum tipo cadastrado."/>}</div></article></div><div className="info-strip categories-tip"><Tags size={20}/><span>As categorias e tipos cadastrados ficam disponíveis automaticamente ao criar um lançamento.</span></div></section>
}

function AuditLogs({ finance }) {
  const labels = { name: 'Descrição', value: 'Valor', dueDay: 'Vencimento', type: 'Tipo', category: 'Categoria', responsible: 'Responsável', installments: 'Parcelas', startPeriod: 'Primeira parcela', flow: 'Fluxo', isCreditCard: 'Lançamento no cartão', cardName: 'Cartão' }
  const formatValue = (key, value) => {
    if (key === 'value') return money(value)
    if (key === 'dueDay') return `Dia ${value}`
    if (key === 'installments') return value || 'Recorrente'
    if (key === 'startPeriod') return value || 'Não se aplica'
    if (key === 'flow') return value === 'receivable' ? 'Conta a receber' : 'Conta a pagar'
    if (key === 'isCreditCard') return value ? 'Sim' : 'Não'
    if (key === 'responsible') return finance.people.find(person => person.id === value)?.name || 'Não definido'
    return value || 'Não informado'
  }
  return <section className="content"><div className="page-title"><div><p className="eyebrow">ANÁLISE</p><h1>Histórico de alterações</h1><p className="sub">Audite os lançamentos editados, com os valores anteriores e novos.</p></div></div><div className="audit-list">{(finance.logs || []).map(log => { const before = log.changes?.before || {}; const after = log.changes?.after || {}; const changes = Object.keys(labels).filter(key => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)); return <article className="audit-card" key={log.id}><div className="audit-card-head"><div><span className="audit-badge">Lançamento editado</span><h2>{after.name || before.name || 'Lançamento removido'}</h2></div><time>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(log.createdAt))}</time></div>{changes.length ? <div className="audit-changes">{changes.map(key => <div key={key}><span>{labels[key]}</span><del>{formatValue(key, before[key])}</del><strong>{formatValue(key, after[key])}</strong></div>)}</div> : <p className="audit-empty-change">Nenhuma alteração de campo identificada.</p>}</article> })}{!(finance.logs || []).length && <Empty text="Nenhuma alteração registrada ainda. Ao editar um lançamento, o histórico aparecerá aqui."/>}</div></section>
}

function SettingsPage({ finance }) {
  const exportBackup = () => {
    const backup = { exportedAt: new Date().toISOString(), people: finance.people, incomes: finance.incomes, bills: finance.bills, payments: finance.payments }
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `conta-certa-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  return <section className="content settings-page"><div className="page-title"><div><p className="eyebrow">CONFIGURAÇÕES</p><h1>Seu espaço, suas regras.</h1><p className="sub">Gerencie acesso, preferências e uma cópia dos seus dados.</p></div></div><div className="settings-grid"><article className="panel settings-card account-card"><div className="settings-icon purple"><ShieldCheck/></div><h2>Conta protegida</h2><p>Você está conectado com segurança usando o Supabase.</p><div className="account-email"><span>{finance.user.email?.slice(0,2).toUpperCase()}</span><div><strong>{finance.user.email}</strong><small><CheckCircle2 size={13}/>E-mail autenticado</small></div></div></article><ProfileNameCard user={finance.user} updateDisplayName={finance.updateDisplayName}/><PasswordCard changePassword={finance.changePassword}/><PasskeyCard finance={finance}/><FamilyCard finance={finance}/><article className="panel settings-card"><div className="settings-icon coral"><CalendarDays/></div><h2>Visão de futuro</h2><p>Escolha o alcance da projeção apresentada na página inicial.</p><label className="settings-label">Meses na projeção<select value={finance.preferences.projectionMonths} onChange={event => finance.updatePreferences({ projectionMonths: Number(event.target.value) })}><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option></select></label><small className="settings-note">Essa preferência fica salva neste dispositivo.</small></article><article className="panel settings-card"><div className="settings-icon green"><Database/></div><h2>Seus dados</h2><p>Faça uma cópia portátil das pessoas, receitas, contas e pagamentos.</p><button className="secondary settings-action" onClick={exportBackup}><Download size={16}/>Exportar backup (.json)</button><small className="settings-note">O arquivo não contém sua senha nem credenciais.</small></article><article className="panel settings-card privacy-card"><div className="settings-icon purple"><CreditCard/></div><h2>Privacidade financeira</h2><p>Os dados desta família são protegidos por RLS e só ficam visíveis aos membros que aceitaram o convite por e-mail.</p><div className="privacy-badge"><ShieldCheck size={16}/>Família protegida por RLS</div></article></div></section>
}

function FamilyCard({ finance }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async event => {
    event.preventDefault()
    setMessage('')
    setLoading(true)
    const error = await finance.inviteFamilyMember(email.trim().toLowerCase())
    setLoading(false)
    if (error) return setMessage(error)
    setEmail('')
    setMessage('Convite enviado. A pessoa precisa confirmar o e-mail e aceitar o compartilhamento.')
  }
  const cancel = async id => {
    setLoading(true)
    const error = await finance.cancelFamilyInvite(id)
    setLoading(false)
    setMessage(error || 'Convite cancelado.')
  }
  return <article className="panel settings-card family-card"><div className="settings-icon green"><Users/></div><h2>Família</h2><p>Todos os membros que aceitarem o convite podem consultar, criar e alterar os mesmos lançamentos.</p><div className="family-members">{finance.family.members.map(member => <div className="family-member" key={member.user_id}><span>{member.email.slice(0, 2).toUpperCase()}</span><strong>{member.email}{member.user_id === finance.user.id && ' (você)'}</strong></div>)}</div><form onSubmit={submit}><label className="settings-label">E-mail do familiar<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="familiar@email.com"/></label>{message && <div className={message.startsWith('Convite enviado') || message.startsWith('Convite cancelado') ? 'settings-success' : 'login-error'}>{message}</div>}<button className="primary settings-action" disabled={loading}><UserPlus size={16}/>{loading ? 'Enviando…' : 'Convidar familiar'}</button></form>{finance.family.invites.length > 0 && <div className="family-pending"><small>CONVITES PENDENTES</small>{finance.family.invites.map(invite => <div key={invite.id}><span><Mail size={14}/>{invite.email}</span><button type="button" className="text-danger" disabled={loading} onClick={() => cancel(invite.id)}>Cancelar</button></div>)}</div>}<small className="settings-note">O convite expira em 7 dias. Cada pessoa confirma o próprio e-mail antes de entrar.</small></article>
}

function FamilyInvitationModal({ token, finance, onClose, onAccepted }) {
  const [state, setState] = useState({ loading: true, valid: false, message: '' })
  const [accepting, setAccepting] = useState(false)
  useEffect(() => {
    let active = true
    finance.getFamilyInvitation(token).then(result => {
      if (!active) return
      if (result.error) return setState({ loading: false, valid: false, message: result.error })
      setState({ loading: false, valid: Boolean(result.data), message: result.data ? '' : 'Este convite expirou, já foi usado ou foi enviado para outro e-mail.' })
    })
    return () => { active = false }
  }, [token])
  const accept = async () => {
    setAccepting(true)
    const error = await finance.acceptFamilyInvitation(token)
    setAccepting(false)
    if (error) return setState(current => ({ ...current, message: error }))
    onAccepted()
  }
  return <Modal title="Convite para família" onClose={onClose}><div className="family-invitation">{state.loading ? <p>Verificando seu convite…</p> : state.valid ? <><div className="settings-icon green"><Users/></div><h3>Compartilhar este espaço financeiro?</h3><p>Ao aceitar, você terá os mesmos privilégios para visualizar, criar e editar os lançamentos desta família.</p>{state.message && <div className="login-error">{state.message}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Agora não</button><button className="primary" onClick={accept} disabled={accepting}>{accepting ? 'Aceitando…' : 'Aceitar convite'}</button></div></> : <><div className="login-error">{state.message}</div><div className="modal-actions"><button type="button" className="primary" onClick={onClose}>Fechar</button></div></>}</div></Modal>
}

function ProfileNameCard({ user, updateDisplayName }) {
  const [name, setName] = useState(user.user_metadata?.display_name || '')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async event => { event.preventDefault(); const trimmed = name.trim(); if (!trimmed) return setStatus('Digite como você gostaria de ser chamado.'); setSaving(true); const error = await updateDisplayName(trimmed); setSaving(false); setStatus(error || 'Nome salvo. Ele já aparece na página inicial.') }
  return <article className="panel settings-card name-card"><div className="settings-icon green"><Users/></div><h2>Como devemos chamar você?</h2><p>Esse nome aparece na saudação da página inicial e no menu do aplicativo.</p><form onSubmit={submit}><label className="settings-label">Seu nome<input required maxLength="40" value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Paulino"/></label>{status && <div className={status.startsWith('Nome salvo') ? 'settings-success' : 'login-error'}>{status}</div>}<button className="primary settings-action" disabled={saving}>{saving ? 'Salvando…' : 'Salvar meu nome'}</button></form></article>
}

function PasskeyCard({ finance }) {
  const [passkeys, setPasskeys] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const refresh = async () => {
    setLoading(true)
    const result = await finance.listPasskeys()
    setLoading(false)
    setPasskeys(result.data)
    if (result.error) setMessage(result.error)
  }
  useEffect(() => { refresh() }, [])
  const enable = async () => {
    setMessage('')
    setLoading(true)
    const result = await finance.registerPasskey()
    setLoading(false)
    if (result.error) return setMessage(result.error)
    setMessage('Chave de acesso adicionada com verificação segura do Supabase.')
    refresh()
  }
  const remove = async id => {
    setLoading(true)
    const error = await finance.removePasskey(id)
    setLoading(false)
    if (error) return setMessage(error)
    setMessage('Chave de acesso removida.')
    refresh()
  }
  return <article className="panel settings-card biometric-card"><div className="settings-icon green"><Fingerprint/></div><h2>Face ID ou digital</h2><p>Use uma chave de acesso para entrar com a biometria ou bloqueio de tela deste dispositivo.</p>{message && <div className={message.includes('adicionada') || message.includes('removida') ? 'settings-success' : 'login-error'}>{message}</div>}{passkeys.length > 0 && <div className="passkey-list">{passkeys.map(passkey => <div className="passkey-item" key={passkey.id}><Fingerprint size={16}/><div><strong>{passkey.friendly_name || 'Chave de acesso'}</strong><small>Login protegido por este dispositivo</small></div><button className="text-danger" onClick={() => remove(passkey.id)} disabled={loading}>Remover</button></div>)}</div>}<button className="primary settings-action" onClick={enable} disabled={loading}><Fingerprint size={16}/>{loading ? 'Verificando…' : 'Adicionar Face ID ou digital'}</button><small className="settings-note">Antes, ative Passkeys em Authentication → Passkeys no Supabase. Em produção, HTTPS é obrigatório.</small></article>
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
  const bills = finance.bills.filter(bill => !isCreditCardBill(bill) && isBillActiveInPeriod(bill, period)).map(b => ({ ...b, status: finance.getStatus(b, period) })).filter(bill => filter === 'Todos' || filter === 'A pagar' && isPayable(bill) || filter === 'A receber' && !isPayable(bill) || bill.type === filter)
  return <section className="content"><div className="page-title"><div><p className="eyebrow">LANÇAMENTOS</p><h1>Contas a pagar e a receber</h1><p className="sub">Registre despesas, entradas previstas e acompanhe cada vencimento.</p></div><button className="primary" onClick={() => openModal('bill')}><Plus size={18}/>Novo lançamento</button></div><div className="filters">{['Todos', 'A pagar', 'A receber', ...finance.types.map(type => type.name)].map(item => <button key={item} onClick={() => setFilter(item)} className={filter === item ? 'selected' : ''}>{item === 'Todos' ? 'Todos os lançamentos' : item}</button>)}</div><article className="panel table-panel"><div className="table-head"><span>DESCRIÇÃO</span><span>TIPO</span><span>VENCIMENTO</span><span>RESPONSÁVEL</span><span>VALOR</span><span>STATUS</span><span/></div>{bills.map(b => { const p=finance.people.find(x=>x.id===b.responsible); const receivable = !isPayable(b); return <div className="table-row" key={b.id}><div><b>{b.name}</b><small>{receivable ? 'A receber' : 'A pagar'} · {b.category}</small></div><span className={`tag ${receivable ? 'receivable' : b.type === 'Fixa' ? 'fixed' : 'variable'}`}>{receivable ? 'Receber' : b.type}</span><span>Dia {b.dueDay}</span><span>{p?.name || '—'}</span><strong className={receivable ? 'income-value' : ''}>{money(b.value)}</strong><button className={b.status === 'paid' ? 'status paid-status clickable' : 'status clickable'} onClick={() => finance.toggleBill(b, period)}>{b.status === 'paid' ? (receivable ? 'Recebido' : 'Pago') : 'Pendente'}</button><button className="edit" title="Editar lançamento" onClick={() => openModal({ type: 'edit-bill', bill: b })}><Pencil size={15}/></button><button className="delete" onClick={() => finance.remove('bills', b.id)}><Trash2 size={16}/></button></div>})}{bills.length === 0 && <Empty text="Nenhum lançamento neste filtro."/>}</article></section>
}

function CreditCardBills({ finance, openModal }) {
  const period = periodKey(today)
  const bills = finance.bills.filter(bill => isCreditCardBill(bill) && isBillActiveInPeriod(bill, period)).map(bill => ({ ...bill, status: finance.getStatus(bill, period) })).sort((a, b) => a.dueDay - b.dueDay)
  const total = bills.reduce((sum, bill) => sum + bill.value, 0)
  const cards = Object.values(bills.reduce((groups, bill) => {
    const name = bill.cardName || 'Cartão de crédito'
    if (!groups[name]) groups[name] = { name, bills: [], total: 0 }
    groups[name].bills.push(bill); groups[name].total += bill.value
    return groups
  }, {}))
  return <section className="content"><div className="page-title"><div><p className="eyebrow">CARTÃO DE CRÉDITO</p><h1>Compras no cartão</h1><p className="sub">Cada fatura é a soma das compras e parcelas vinculadas ao mesmo cartão.</p></div><div className="card-actions"><button className="secondary" onClick={() => openModal('import-card-invoice')}><Download size={17}/>Importar fatura</button><button className="primary" onClick={() => openModal('card-bill')}><Plus size={18}/>Nova compra no cartão</button></div></div><div className="cards credit-summary"><Metric label="Fatura total" value={money(total)} icon={<CreditCard/>} tint="coral" detail={`${bills.length} lançamento${bills.length !== 1 ? 's' : ''} no cartão`}/><Metric label="Cartões ativos" value={String(cards.length)} icon={<CalendarDays/>} tint="purple" detail="Faturas calculadas por cartão"/></div><div className="card-invoice-list">{cards.map(card => <article className="panel card-invoice" key={card.name}><div><span>FATURA · {card.name}</span><strong>{money(card.total)}</strong></div><small>{card.bills.length} compra{card.bills.length !== 1 ? 's' : ''} lançada{card.bills.length !== 1 ? 's' : ''}</small></article>)}</div><article className="panel table-panel credit-table"><div className="table-head"><span>DESCRIÇÃO</span><span>TIPO</span><span>VENCIMENTO</span><span>RESPONSÁVEL</span><span>VALOR</span><span>STATUS</span><span/><span/></div>{bills.map(bill => { const person = finance.people.find(item => item.id === bill.responsible); return <div className="table-row" key={bill.id}><div><b>{bill.name}</b><small>{bill.cardName || 'Cartão de crédito'} · {bill.category}{bill.installments ? ` · ${bill.installments} parcela${bill.installments > 1 ? 's' : ''}` : ''}</small></div><span className={`tag ${bill.type === 'Fixa' ? 'fixed' : 'variable'}`}>{bill.type}</span><span>Dia {bill.dueDay}</span><span>{person?.name || '—'}</span><strong>{money(bill.value)}</strong><button className={bill.status === 'paid' ? 'status paid-status clickable' : 'status clickable'} onClick={() => finance.toggleBill(bill, period)}>{bill.status === 'paid' ? 'Pago' : 'Pendente'}</button><button className="edit" title="Editar lançamento" onClick={() => openModal({ type: 'edit-bill', bill })}><Pencil size={15}/></button><button className="delete" onClick={() => finance.remove('bills', bill.id)}><Trash2 size={16}/></button></div> })}{!bills.length && <Empty text="Nenhuma compra no cartão para este mês."/>}</article></section>
}

function CardInvoiceImportModal({ finance, onClose }) {
  const [invoice, setInvoice] = useState(null)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [reading, setReading] = useState({ current: 0, total: 0, label: '' })
  const [message, setMessage] = useState('')
  const [cardName, setCardName] = useState('')
  const [saving, setSaving] = useState(false)
  const readFile = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    setLoading(true); setMessage(''); setReading({ current: 0, total: 0, label: 'Preparando a leitura…' })
    try {
      await new Promise(resolve => requestAnimationFrame(resolve))
      const parsed = await parseCreditCardInvoicePdf(file, { onProgress: setReading })
      setInvoice(parsed); setFileName(file.name); setCardName(parsed.issuer)
    } catch (error) { setMessage(error.message || 'Não foi possível ler esta fatura.') }
    setLoading(false)
  }
  const updateEntry = (id, updates) => setInvoice(current => ({ ...current, entries: current.entries.map(entry => entry.id === id ? { ...entry, ...updates } : entry) }))
  const selectedEntries = invoice?.entries.filter(entry => entry.included) || []
  const selectedTotal = selectedEntries.reduce((sum, entry) => sum + Number(entry.value || 0), 0)
  const isExact = invoice && Math.abs(selectedTotal - invoice.total) < 0.01
  const confirm = async () => {
    if (!invoice || !isExact || !cardName.trim()) return
    setSaving(true); setMessage('')
    const dueDate = invoice.dueDate.split('/').reverse().join('-')
    const savedInvoice = { id: crypto.randomUUID(), cardName: cardName.trim(), invoiceKey: invoice.invoiceKey, statementTotal: invoice.total, dueDate, sourceFileName: fileName }
    const bills = selectedEntries.filter(entry => Number(entry.value) !== 0).map(entry => ({ id: crypto.randomUUID(), name: entry.description, value: Number(entry.value), dueDay: invoice.dueDay, type: entry.installmentsLeft > 1 ? 'Parcelada' : 'Fatura importada', category: entry.category || 'Outros', responsible: '', installments: Math.max(1, Number(entry.installmentsLeft) || 1), startPeriod: invoice.period, flow: 'payable', isCreditCard: true, cardName: cardName.trim(), status: 'pending' }))
    const error = await finance.importCardInvoice({ invoice: savedInvoice, bills })
    setSaving(false)
    if (error) return setMessage(error)
    onClose()
  }
  return <Modal title="Importar fatura do cartão" onClose={onClose}><div className="invoice-import">{loading ? <div className="invoice-reading"><div className="invoice-reader-icon"><CreditCard size={23}/></div><h3>Lendo sua fatura</h3><p>{reading.label || 'Analisando o PDF…'}</p><div className="invoice-reading-bar"><span style={{ width: `${reading.total ? Math.max(8, (reading.current / reading.total) * 100) : 18}%` }}/></div><small>{reading.total ? `Página ${Math.min(reading.current + 1, reading.total)} de ${reading.total}` : 'Isso pode levar alguns segundos.'}</small></div> : !invoice ? <><div className="settings-icon purple"><CreditCard/></div><h3>Leia sua fatura em PDF</h3><p>Os dados são processados neste navegador. Detectaremos o total, as compras e parcelas antes de gravar qualquer lançamento.</p><label className="invoice-file"><input type="file" accept="application/pdf,.pdf" onChange={readFile}/><Download size={18}/>Selecionar PDF da fatura</label>{message && <div className="login-error">{message}</div>}</> : <><div className="invoice-summary"><div><span>IDENTIFICADOR</span><strong>{invoice.invoiceKey}</strong></div><div><span>VENCIMENTO</span><strong>{invoice.dueDate}</strong></div><div><span>TOTAL DA FATURA</span><strong>{money(invoice.total)}</strong></div></div><label>Cartão<input value={cardName} onChange={event => setCardName(event.target.value)} required/></label><div className="invoice-review-head"><strong>Lançamentos identificados</strong><span className={isExact ? 'exact' : 'not-exact'}>{isExact ? 'Total confere' : `Diferença de ${money(invoice.total - selectedTotal)}`}</span></div><div className="invoice-entry-list">{invoice.entries.map(entry => <div className="invoice-entry" key={entry.id}><input type="checkbox" checked={entry.included} onChange={event => updateEntry(entry.id, { included: event.target.checked })}/><div><input value={entry.description} onChange={event => updateEntry(entry.id, { description: event.target.value })}/><small>{entry.date || 'Ajuste da fatura'}{entry.installmentLabel && ` · parcela ${entry.installmentLabel}`}</small></div><input className="invoice-value" type="number" step="0.01" value={entry.value} onChange={event => updateEntry(entry.id, { value: Number(event.target.value) })}/><label className="invoice-installments">Restam<input type="number" min="1" max="360" value={entry.installmentsLeft} onChange={event => updateEntry(entry.id, { installmentsLeft: event.target.value })}/></label></div>)}</div>{message && <div className="login-error">{message}</div>}<p className="modal-note">Revise os lançamentos. Compras parceladas continuarão na projeção apenas pelo número de parcelas restantes informado na fatura.</p><div className="modal-actions"><button type="button" className="secondary" onClick={() => setInvoice(null)}>Trocar PDF</button><button className="primary" disabled={!isExact || saving || !cardName.trim()} onClick={confirm}>{saving ? 'Importando…' : 'Confirmar e importar'}</button></div></>}</div></Modal>
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
function CategoryModal({ onClose, onSave }) { const [form, setForm] = useState({ name: '', color: '#7067cf' }); const submit = event => { event.preventDefault(); if (!form.name.trim()) return; onSave({ id: crypto.randomUUID(), name: form.name.trim(), color: form.color }) }; return <Modal title="Nova categoria" onClose={onClose}><form onSubmit={submit}><label>Nome da categoria<input autoFocus required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Transporte"/></label><label>Cor de identificação<input className="color-input" type="color" value={form.color} onChange={event => setForm({ ...form, color: event.target.value })}/></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">Salvar categoria</button></div></form></Modal> }
function TypeModal({ onClose, onSave }) { const [name, setName] = useState(''); const submit = event => { event.preventDefault(); if (!name.trim()) return; onSave({ id: crypto.randomUUID(), name: name.trim() }) }; return <Modal title="Novo tipo" onClose={onClose}><form onSubmit={submit}><label>Nome do tipo<input autoFocus required value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Parcelada"/></label><p className="modal-note">Use tipos para diferenciar despesas fixas, variáveis ou qualquer outra regra que fizer sentido.</p><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">Salvar tipo</button></div></form></Modal> }
function BillModal({ people, categories, types, initialPeriod, initialBill, forceCreditCard, onClose, onSave }) {
  const [form, setForm] = useState(() => initialBill ? { name: initialBill.name, value: initialBill.value, dueDay: String(initialBill.dueDay), type: initialBill.type, category: initialBill.category, responsible: initialBill.responsible || '', installments: initialBill.installments || '', startPeriod: initialBill.startPeriod || initialPeriod, flow: initialBill.flow || 'payable', isCreditCard: Boolean(initialBill.isCreditCard), cardName: initialBill.cardName || '', cardInvoiceId: initialBill.cardInvoiceId || null } : { name: '', value: '', dueDay: '10', type: types[0]?.name || '', category: categories[0]?.name || '', responsible: people[0]?.id || '', installments: '', startPeriod: initialPeriod, flow: 'payable', isCreditCard: Boolean(forceCreditCard), cardName: '', cardInvoiceId: null })
  const creditCard = forceCreditCard || form.isCreditCard
  const receivable = form.flow === 'receivable'
  const submit = event => {
    event.preventDefault()
    if (!form.name || !form.value || creditCard && !form.cardName.trim() || !receivable && (!form.type || !form.category)) return
    onSave({ ...form, id: initialBill?.id || crypto.randomUUID(), cardName: creditCard ? form.cardName.trim() : '', flow: creditCard ? 'payable' : form.flow, isCreditCard: creditCard, value: Number(form.value), dueDay: receivable ? 1 : Number(form.dueDay), type: receivable ? 'Recebimento' : form.type, category: receivable ? 'Receitas' : form.category, responsible: receivable ? '' : form.responsible, installments: receivable ? 1 : form.installments ? Number(form.installments) : null, startPeriod: receivable ? form.startPeriod || initialPeriod : form.installments ? form.startPeriod : null, status: initialBill?.status || 'pending' })
  }
  const flowField = <><label>Fluxo<select disabled={creditCard} value={creditCard ? 'payable' : form.flow} onChange={event => setForm({ ...form, flow: event.target.value, installments: event.target.value === 'receivable' ? 1 : '', startPeriod: event.target.value === 'receivable' ? initialPeriod : form.startPeriod })}><option value="payable">Conta a pagar</option><option value="receivable">Conta a receber</option></select></label>{creditCard && <label>Cartão<input required value={form.cardName} onChange={event => setForm({ ...form, cardName: event.target.value })} placeholder="Ex.: Nubank"/></label>}</>
  return <Modal title={initialBill ? 'Editar lançamento' : creditCard ? 'Nova compra no cartão' : 'Novo lançamento'} onClose={onClose}><form onSubmit={submit}>{receivable ? flowField : <div className="form-row">{flowField}<label>Vencimento<input required min="1" max="31" type="number" value={form.dueDay} onChange={event => setForm({ ...form, dueDay: event.target.value })}/></label></div>}<label>Descrição<input autoFocus required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder={receivable ? 'Ex.: Serviço prestado' : 'Ex.: Compra no cartão'}/></label>{receivable ? <label>Valor a receber<CurrencyInput required value={form.value} onValueChange={value => setForm({ ...form, value })} placeholder="R$ 0,00"/></label> : <><div className="form-row"><label>{form.installments ? 'Valor de cada parcela' : 'Valor a pagar'}<CurrencyInput required value={form.value} onValueChange={value => setForm({ ...form, value })} placeholder="R$ 0,00"/></label><label>Tipo<select required value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}>{types.map(type => <option key={type.id} value={type.name}>{type.name}</option>)}</select></label></div><div className="form-row"><label>Categoria<select required value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}>{categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label><label>Responsável<select value={form.responsible} onChange={event => setForm({ ...form, responsible: event.target.value })}><option value="">Não definido</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label></div><div className="form-row"><label>Quantidade de parcelas <small>(vazio = recorrente)</small><input min="1" max="360" type="number" value={form.installments} onChange={event => setForm({ ...form, installments: event.target.value })} placeholder="Ex.: 12"/></label><label>Primeira parcela<input disabled={!form.installments} required={Boolean(form.installments)} type="month" value={form.startPeriod} onChange={event => setForm({ ...form, startPeriod: event.target.value })}/></label></div></>}<p className="modal-note">Contas a pagar reduzem o saldo. Contas a receber são valores únicos e entram como receita somente no mês selecionado.</p><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">{initialBill ? 'Salvar alterações' : 'Salvar lançamento'}</button></div></form></Modal>
}

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
createRoot(document.getElementById('root')).render(<App />)
