import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, MapPin, Store, Wrench, ShoppingBag, Heart, ArrowRight, Menu, X, Plus, ShieldCheck, Sparkles, Building2, Star, Share2 } from 'lucide-react';
import './style.css';
import { isSupabaseConfigured, supabase } from './lib/supabase';

const categories = [
  { name: 'Casa e construção', icon: Building2, count: 'Obras, reformas e materiais' },
  { name: 'Serviços profissionais', icon: Wrench, count: 'Profissionais e especialistas' },
  { name: 'Lojas e comércio', icon: ShoppingBag, count: 'Produtos e lojas da região' },
  { name: 'Empresas', icon: Store, count: 'Negócios locais e nacionais' },
];
const examples = [
  { name: 'Seu negócio pode estar aqui', category: 'Empresas', city: 'Sua cidade', desc: 'Apresente seus produtos e serviços para novos clientes.', tag: 'Espaço demonstrativo', icon: Store },
  { name: 'Profissionais da sua região', category: 'Serviços profissionais', city: 'Perto de você', desc: 'Encontre quem pode ajudar no seu próximo projeto.', tag: 'Em breve', icon: Wrench },
  { name: 'Comércio local', category: 'Lojas e comércio', city: 'Brasil', desc: 'Descubra lojas, novidades e oportunidades.', tag: 'Em breve', icon: ShoppingBag },
];
function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function whatsappLink(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const number = digits.startsWith('55') ? digits : `55${digits}`;
  const message = encodeURIComponent('Olá! Encontrei seu negócio no Conecta Brasil e gostaria de mais informações.');
  return `https://wa.me/${number}?text=${message}`;
}

function App() {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [active, setActive] = useState('Todas');
  const [menu, setMenu] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [sent, setSent] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(isSupabaseConfigured);
  const [loadError, setLoadError] = useState('');
  const [authUser, setAuthUser] = useState(null);
  const [authMode, setAuthMode] = useState('signup');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [availableCategories, setAvailableCategories] = useState([]);
  const [businessForm, setBusinessForm] = useState({ name: '', description: '', business_type: 'empresa', phone: '', city: '', state: '', category_id: '' });
  const [logoFile, setLogoFile] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [shareMessage, setShareMessage] = useState('');
  const [favoriteIds, setFavoriteIds] = useState(() => { try { const saved = JSON.parse(localStorage.getItem('conecta-favorites') || '[]'); return Array.isArray(saved) ? saved.map(String) : []; } catch { return []; } });
  const [showFavorites, setShowFavorites] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [adminBusinesses, setAdminBusinesses] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminFilter, setAdminFilter] = useState('pending');
  const [adminSearch, setAdminSearch] = useState('');
  const [adminError, setAdminError] = useState('');
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [adminCategories, setAdminCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [adminAuditLogs, setAdminAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [ownerBusinesses, setOwnerBusinesses] = useState([]);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState('');
  const [ownerEditing, setOwnerEditing] = useState(null);
  const isAdmin = authUser?.app_metadata?.role === 'admin';

  useEffect(() => { localStorage.setItem('conecta-favorites', JSON.stringify(favoriteIds)); }, [favoriteIds]);

  useEffect(() => {
    if (!selectedPhoto && !selectedBusiness && !showForm) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = event => {
      if (event.key !== 'Escape') return;
      if (selectedPhoto) setSelectedPhoto(null);
      else if (selectedBusiness) closeBusinessDetails();
      else setShowForm(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedPhoto, selectedBusiness, showForm]);

  function toggleFavorite(item) {
    const key = String(item.id || item.name);
    setFavoriteIds(current => current.includes(key) ? current.filter(id => id !== key) : [...current, key]);
  }

  function openBusinessDetails(item) {
    setSelectedBusiness(item);
    setShareMessage('');
    const url = new URL(window.location.href);
    url.searchParams.set('negocio', item.id);
    window.history.pushState({}, '', url);
  }

  function closeBusinessDetails() {
    setSelectedBusiness(null);
    setShareMessage('');
    const url = new URL(window.location.href);
    url.searchParams.delete('negocio');
    window.history.pushState({}, '', url);
  }

  async function shareBusiness(item) {
    const url = new URL(window.location.href);
    url.searchParams.set('negocio', item.id);
    try {
      if (navigator.share) {
        await navigator.share({ title: item.name, text: `Conheça ${item.name} no Conecta Brasil`, url: url.toString() });
      } else {
        await navigator.clipboard.writeText(url.toString());
        setShareMessage('Link copiado! Agora é só compartilhar.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') setShareMessage('Não foi possível compartilhar automaticamente.');
    }
  }

  async function loadAdminAuditLogs() {
    if (!isAdmin) return;
    setAuditLoading(true);
    const { data, error } = await supabase.from('admin_audit_logs')
      .select('id,action,entity_type,entity_name,details,actor_email,created_at')
      .order('created_at', { ascending: false }).limit(100);
    if (error) setAdminError('Não foi possível carregar o histórico. Execute o SQL supabase/admin_audit.sql no Supabase.');
    else setAdminAuditLogs(data || []);
    setAuditLoading(false);
  }

  async function recordAdminAction(action, entityType, entityId, entityName, details = {}) {
    const { error } = await supabase.from('admin_audit_logs').insert({
      action, entity_type: entityType, entity_id: entityId,
      entity_name: entityName, actor_email: authUser?.email || null, details
    });
    if (error) {
      setAdminError('A ação foi concluída, mas não foi possível registrar no histórico. Confira o SQL de auditoria no Supabase.');
      return;
    }
    await loadAdminAuditLogs();
  }

  async function loadAdminBusinesses() {
    if (!isAdmin) return;
    setAdminLoading(true); setAdminError('');
    const { data, error } = await supabase.from('businesses')
      .select('id,name,description,business_type,phone,city,state,status,featured,created_at,logo_url,gallery_urls,business_categories(categories(name))')
      .order('created_at', { ascending: false });
    if (error) setAdminError('Não foi possível carregar os cadastros. Confira se sua conta tem permissão de administrador.');
    else setAdminBusinesses(data || []);
    const cats = await supabase.from('categories').select('id,name,active').order('name');
    if (!cats.error) setAdminCategories(cats.data || []);
    await loadAdminAuditLogs();
    setAdminLoading(false);
  }

  async function saveBusinessEdit(event) {
    event.preventDefault(); if (!editingBusiness) return;
    setFormBusy(true); setAdminError('');
    const payload = { name: editingBusiness.name.trim(), description: editingBusiness.description.trim(), phone: editingBusiness.phone.trim(), city: editingBusiness.city.trim(), state: editingBusiness.state.trim().toUpperCase() };
    const { error } = await supabase.from('businesses').update(payload).eq('id', editingBusiness.id);
    if (error) setAdminError('Não foi possível salvar a edição: ' + error.message);
    else { setAdminBusinesses(rows => rows.map(row => row.id === editingBusiness.id ? { ...row, ...payload } : row)); await recordAdminAction('editado', 'anúncio', editingBusiness.id, payload.name, payload); setEditingBusiness(null); }
    setFormBusy(false);
  }

  async function addAdminCategory(event) {
    event.preventDefault();
    const name = newCategory.trim();
    if (!name) return;

    const slug = name.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `categoria-${Date.now()}`;

    setFormBusy(true);
    setAdminError('');
    const { data, error } = await supabase
      .from('categories')
      .insert({ name, slug, active: true })
      .select('id,name,active')
      .single();

    if (error) {
      const message = error.code === '23505'
        ? 'Já existe uma categoria com esse nome ou endereço. Escolha outro nome.'
        : error.message;
      setAdminError('Não foi possível criar a categoria: ' + message);
    } else {
      setAdminCategories(rows => [...rows, data].sort((a,b)=>a.name.localeCompare(b.name)));
      setNewCategory('');
      setAvailableCategories(rows => [...rows, {id:data.id,name:data.name}].sort((a,b)=>a.name.localeCompare(b.name)));
      await recordAdminAction('criada', 'categoria', data.id, data.name);
    }
    setFormBusy(false);
  }

  async function toggleCategory(category) {
    setFormBusy(true); setAdminError('');
    const { error } = await supabase.from('categories').update({ active: !category.active }).eq('id', category.id);
    if (error) setAdminError('Não foi possível alterar a categoria: ' + error.message);
    else { setAdminCategories(rows => rows.map(row => row.id === category.id ? {...row,active:!category.active} : row)); setAvailableCategories(rows => category.active ? rows.filter(row=>row.id!==category.id) : [...rows,{id:category.id,name:category.name}]); await recordAdminAction(category.active ? 'desativada' : 'ativada', 'categoria', category.id, category.name); }
    setFormBusy(false);
  }

  async function toggleFeatured(item) {
    setFormBusy(true); setAdminError('');
    const { error } = await supabase.from('businesses').update({ featured: !item.featured }).eq('id', item.id);
    if (error) setAdminError('Não foi possível alterar o destaque: ' + error.message);
    else { setAdminBusinesses(items => items.map(row => row.id === item.id ? { ...row, featured: !item.featured } : row)); await recordAdminAction(item.featured ? 'destaque removido' : 'destacado', 'anúncio', item.id, item.name); }
    setFormBusy(false);
  }

  async function deleteBusiness(item) {
    const confirmed = window.confirm(`Excluir definitivamente o anúncio "${item.name}"? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;

    setFormBusy(true);
    setAdminError('');
    const { error } = await supabase.from('businesses').delete().eq('id', item.id);
    if (error) {
      setAdminError('Não foi possível excluir o anúncio: ' + error.message);
    } else {
      setAdminBusinesses(items => items.filter(row => row.id !== item.id));
      await recordAdminAction('excluído', 'anúncio', item.id, item.name, { status_anterior: item.status });
      if (editingBusiness?.id === item.id) setEditingBusiness(null);
      setAdminError('');
    }
    setFormBusy(false);
  }

  async function moderateBusiness(id, status) {
    setFormBusy(true); setAdminError('');
    const { error } = await supabase.from('businesses').update({ status }).eq('id', id);
    if (error) setAdminError('Não foi possível atualizar este cadastro: ' + error.message);
    else {
      const changed = adminBusinesses.find(item => item.id === id);
      setAdminBusinesses(items => items.map(item => item.id === id ? { ...item, status } : item));
      await recordAdminAction(status === 'approved' ? 'aprovado' : status === 'rejected' ? 'rejeitado' : status === 'suspended' ? 'suspenso' : 'retornado para análise', 'anúncio', id, changed?.name || 'Anúncio', { status_novo: status, status_anterior: changed?.status || null });
      if (status === 'approved') {
        const { data } = await supabase.from('businesses')
          .select('id,name,description,business_type,phone,city,state,featured,logo_url,gallery_urls,business_categories(categories(name))')
          .eq('status', 'approved').order('featured', { ascending: false }).order('name');
        if (data) setBusinesses(data.map(item => ({
          id: item.id, name: item.name,
          category: item.business_categories?.[0]?.categories?.name || 'Empresas',
          city: [item.city, item.state].filter(Boolean).join(' - '),
          desc: item.description || 'Conheça este negócio cadastrado no Conecta Brasil.',
          tag: item.business_type || 'Negócio', icon: Store, logo: item.logo_url || '', photos: item.gallery_urls || []
        })));
      }
    }
    setFormBusy(false);
  }

  useEffect(() => {
    if (showForm && isAdmin) loadAdminBusinesses();
  }, [showForm, isAdmin]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase.auth.getSession().then(({ data }) => setAuthUser(data.session?.user || null));
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthUser(session?.user || null);
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setFormMessage('Defina uma nova senha para sua conta.');
        setFormError('');
      }
    });
    supabase.from('categories').select('id,name').eq('active', true).order('name')
      .then(({ data }) => setAvailableCategories(data || []));
    return () => authListener.subscription.unsubscribe();
  }, []);

  async function loadOwnerBusinesses() {
    if (!authUser || isAdmin) return;
    setOwnerLoading(true); setOwnerError('');
    const { data, error } = await supabase.from('businesses')
      .select('id,name,description,business_type,phone,city,state,status,created_at,updated_at,business_categories(categories(name))')
      .eq('owner_id', authUser.id).order('created_at', { ascending: false });
    if (error) setOwnerError('Não foi possível carregar seus anúncios. Tente novamente.');
    else setOwnerBusinesses(data || []);
    setOwnerLoading(false);
  }

  async function saveOwnerBusiness(event) {
    event.preventDefault();
    if (!ownerEditing) return;
    setFormBusy(true); setOwnerError('');
    const originalStatus = ownerEditing.status;
    const payload = {
      name: ownerEditing.name.trim(), description: (ownerEditing.description || '').trim(),
      business_type: ownerEditing.business_type, phone: (ownerEditing.phone || '').trim(),
      city: ownerEditing.city.trim(), state: ownerEditing.state.trim().toUpperCase(),
      ...(originalStatus === 'approved' ? { status: 'pending', featured: false } : {})
    };
    const { data, error } = await supabase.from('businesses').update(payload)
      .eq('id', ownerEditing.id).eq('owner_id', authUser.id).eq('status', originalStatus)
      .select('id').maybeSingle();
    if (error || !data) setOwnerError('Não foi possível salvar. Confira se a atualização de permissões do anunciante foi aplicada no Supabase.' + (error?.message ? ' ' + error.message : ''));
    else {
      setOwnerBusinesses(rows => rows.map(row => row.id === ownerEditing.id ? { ...row, ...payload, updated_at: new Date().toISOString() } : row));
      setOwnerEditing(null);
      setFormMessage(originalStatus === 'approved'
        ? 'Alterações enviadas! Seu anúncio ficará temporariamente em análise até a nova aprovação.'
        : 'Alterações salvas. Seu anúncio continua aguardando aprovação.');
    }
    setFormBusy(false);
  }

  useEffect(() => {
    if (authUser && !isAdmin) loadOwnerBusinesses();
    else setOwnerBusinesses([]);
  }, [authUser?.id, isAdmin]);

  async function requestPasswordRecovery() {
    if (!authEmail.trim()) { setFormError('Informe seu e-mail para receber o link de recuperação.'); return; }
    setFormBusy(true); setFormError(''); setFormMessage('');
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), { redirectTo });
      if (error) throw error;
      setFormMessage('Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha. Confira também a caixa de spam.');
    } catch (error) { setFormError(error.message || 'Não foi possível solicitar a recuperação.'); }
    finally { setFormBusy(false); }
  }

  async function updateRecoveredPassword(event) {
    event.preventDefault();
    if (newPassword.length < 6) { setFormError('A nova senha deve ter pelo menos 6 caracteres.'); return; }
    setFormBusy(true); setFormError(''); setFormMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordRecovery(false); setNewPassword(''); setAuthPassword('');
      setFormMessage('Senha alterada com sucesso! Sua conta já está pronta para uso.');
    } catch (error) { setFormError(error.message || 'Não foi possível alterar a senha.'); }
    finally { setFormBusy(false); }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setFormBusy(true); setFormError(''); setFormMessage('');
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        if (data.session) {
          setAuthUser(data.user);
          setFormMessage('Conta criada! Agora preencha os dados do seu negócio.');
        } else {
          setFormMessage('Conta criada. Confira seu e-mail para confirmar o cadastro. Depois, entre aqui para anunciar.');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
        setAuthUser(data.user);
        setFormMessage('Acesso confirmado. Preencha os dados do seu negócio.');
      }
    } catch (error) { setFormError(error.message || 'Não foi possível concluir o acesso.'); }
    finally { setFormBusy(false); }
  }

  async function handleBusinessSubmit(event) {
    event.preventDefault();
    setFormBusy(true); setFormError(''); setFormMessage('');
    try {
      const slugBase = businessForm.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const slug = slugBase + '-' + crypto.randomUUID().slice(0, 8);
      const { data, error } = await supabase.from('businesses').insert({
        owner_id: authUser.id, name: businessForm.name.trim(), slug,
        description: businessForm.description.trim(), business_type: businessForm.business_type,
        phone: businessForm.phone.trim(), city: businessForm.city.trim(),
        state: businessForm.state.trim().toUpperCase(), status: 'pending', featured: false
      }).select('id').single();
      if (error) throw error;
      const businessId = data.id;
      const uploadedPhotos = [];
      const uploadImage = async (file, label) => {
        if (!file) return null;
        if (!file.type.startsWith('image/')) throw new Error('Envie somente arquivos de imagem.');
        if (file.size > 5 * 1024 * 1024) throw new Error(`A imagem ${file.name} ultrapassa o limite de 5 MB.`);
        const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
        const path = `${authUser.id}/${businessId}/${label}-${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('business-images').upload(path, file, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        return supabase.storage.from('business-images').getPublicUrl(path).data.publicUrl;
      };
      const logoUrl = await uploadImage(logoFile, 'logo');
      for (let i = 0; i < galleryFiles.length; i++) uploadedPhotos.push(await uploadImage(galleryFiles[i], `foto-${i + 1}`));
      if (logoUrl || uploadedPhotos.length) {
        const { error: imageError } = await supabase.from('businesses').update({ logo_url: logoUrl, gallery_urls: uploadedPhotos }).eq('id', businessId);
        if (imageError) throw imageError;
      }
      if (businessForm.category_id) {
        const { error: categoryError } = await supabase.from('business_categories').insert({
          business_id: data.id, category_id: businessForm.category_id
        });
        if (categoryError) throw categoryError;
      }
      setFormMessage('Cadastro enviado para análise! Seu negócio aparecerá na vitrine depois da aprovação.');
      await loadOwnerBusinesses();
      setBusinessForm({ name: '', description: '', business_type: 'empresa', phone: '', city: '', state: '', category_id: '' });
      setLogoFile(null); setGalleryFiles([]);
    } catch (error) { setFormError(error.message || 'Não foi possível enviar o cadastro.'); }
    finally { setFormBusy(false); }
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let alive = true;
    supabase
      .from('businesses')
      .select('id,name,description,business_type,phone,city,state,logo_url,gallery_urls,business_categories(categories(name))')
      .eq('status', 'approved')
      .order('featured', { ascending: false })
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setLoadError('Não foi possível carregar os cadastros agora.');
        else setBusinesses((data || []).map(item => ({
          id: item.id,
          name: item.name,
          category: item.business_categories?.[0]?.categories?.name || 'Empresas',
          city: [item.city, item.state].filter(Boolean).join(' - '),
          desc: item.description || 'Conheça este negócio cadastrado no Conecta Brasil.',
          tag: item.business_type || 'Negócio',
          featured: Boolean(item.featured),
          phone: item.phone || '',
          icon: Store, logo: item.logo_url || '', photos: item.gallery_urls || [],
        })));
        setLoadingBusinesses(false);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!businesses.length) return;
    const openFromUrl = () => {
      const id = new URLSearchParams(window.location.search).get('negocio');
      setSelectedBusiness(id ? businesses.find(item => String(item.id) === id) || null : null);
    };
    openFromUrl();
    window.addEventListener('popstate', openFromUrl);
    return () => window.removeEventListener('popstate', openFromUrl);
  }, [businesses]);

  const listingSource = isSupabaseConfigured ? businesses : examples;
  const citySuggestions = useMemo(() => [...new Set(listingSource
    .map(item => item.city).filter(Boolean)
    .map(value => value.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [listingSource]);
  const filtered = useMemo(() => listingSource.filter(item =>
    (active === 'Todas' || item.category === active) &&
    normalizeSearch([item.name, item.desc, item.category, item.city, item.phone].join(' ')).includes(normalizeSearch(query)) &&
    (!city || normalizeSearch(item.city).includes(normalizeSearch(city))) &&
    (!showFavorites || favoriteIds.includes(String(item.id || item.name)))
  ), [listingSource, query, active, city, showFavorites, favoriteIds]);
  const hasActiveFilters = Boolean(query.trim() || city.trim() || active !== 'Todas' || showFavorites);
  function clearFilters() { setQuery(''); setCity(''); setActive('Todas'); setShowFavorites(false); }
  const publicCategories = availableCategories.length
    ? availableCategories.map((category, index) => ({
        ...category,
        icon: categories[index % categories.length].icon,
        count: 'Explore negócios nesta categoria'
      }))
    : categories;
  return <div className="app">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark"><span></span><span></span><span></span></span><span>conecta<span className="brand-light">brasil</span><small>CONEXÕES QUE MOVIMENTAM</small></span></a>
      <button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label="Abrir menu">{menu ? <X/> : <Menu/>}</button>
      <nav className={menu ? 'nav open' : 'nav'}><a href="#categorias" onClick={()=>setMenu(false)}>Categorias</a><a href="#explorar" onClick={()=>setMenu(false)}>Explorar</a><a href="#sobre" onClick={()=>setMenu(false)}>Sobre</a>{isAdmin && <button className="btn btn-small admin-nav" onClick={()=>{setShowForm(true);setMenu(false)}}><ShieldCheck size={16}/> Administração</button>}<button className="btn btn-small" onClick={()=>{setShowForm(true);setMenu(false)}}><Plus size={16}/> Anunciar negócio</button></nav>
    </header>
    <main>
      <section className="hero"><div className="hero-glow"></div><div className="hero-content"><div className="eyebrow"><Sparkles size={15}/> UM BRASIL DE OPORTUNIDADES</div><h1>O que você procura.<br/><em>Mais perto de você.</em></h1><p>Encontre empresas, profissionais, lojas e serviços. Valorize quem faz a economia acontecer em cada cidade do Brasil.</p>
        <div className="search-panel"><label className="search-field"><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="O que você está procurando?"/></label><span className="search-divider"></span><label className="search-field city-field"><MapPin size={20}/><input list="city-suggestions" value={city} onChange={e=>setCity(e.target.value)} placeholder="Cidade ou região"/><datalist id="city-suggestions">{citySuggestions.map(value=><option key={value} value={value}/>)}</datalist></label><button className="btn search-btn" onClick={()=>document.getElementById('explorar').scrollIntoView({behavior:'smooth'})}>Buscar <ArrowRight size={17}/></button></div>
        <div className="hero-note"><ShieldCheck size={15}/> Uma plataforma para conectar pessoas e negócios.</div>
      </div><div className="hero-art"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="map-card"><div className="map-lines"></div><div className="pin pin-a"><MapPin/></div><div className="pin pin-b"><MapPin/></div><div className="pin pin-c"><MapPin/></div><div className="map-center"><span>BR</span><b>Brasil</b><small>Grandes conexões começam localmente</small></div></div><div className="float-card float-top"><span className="float-icon"><Store/></span><span><b>Negócios locais</b><small>Ganham visibilidade</small></span></div><div className="float-card float-bottom"><span className="float-icon green"><Heart/></span><span><b>Comunidade forte</b><small>Todo mundo conectado</small></span></div></div></section>
      <section className="trust-strip"><div><b>1 só lugar</b><span>para encontrar</span></div><i></i><div><b>Seu município</b><span>como ponto de partida</span></div><i></i><div><b>Todo o Brasil</b><span>como horizonte</span></div></section>
      <section className="section categories" id="categorias"><div className="section-heading"><div><div className="eyebrow dark">EXPLORE POSSIBILIDADES</div><h2>O Brasil tem de tudo.<br/><em>Encontre aqui.</em></h2></div><p>Uma vitrine para negócios de todos os tamanhos e uma busca simples para quem precisa encontrar soluções.</p></div><div className="category-grid">{publicCategories.map(({name,icon:Icon,count},i)=><button className="category-card" key={name} onClick={()=>{setActive(name);document.getElementById('explorar').scrollIntoView({behavior:'smooth'})}}><span className={'cat-icon cat-'+i}><Icon size={23}/></span><b>{name}</b><small>{count}</small><ArrowRight className="cat-arrow" size={18}/></button>)}</div></section>
      <section className="explore-section" id="explorar"><div className="section-heading explore-heading"><div><div className="eyebrow dark">VITRINE CONECTA BRASIL</div><h2>Descubra o que existe <em>por perto.</em></h2></div><span className="demo-label">{isSupabaseConfigured ? 'NEGÓCIOS CADASTRADOS' : 'MODO DE DEMONSTRAÇÃO'}</span></div><div className="filters"><div className="filter-pills">{['Todas',...publicCategories.map(c=>c.name)].map(c=><button key={c} className={active===c?'selected':''} onClick={()=>setActive(c)}>{c}</button>)}</div><div className="filter-tools"><button className={showFavorites ? "favorites-filter active" : "favorites-filter"} onClick={()=>setShowFavorites(!showFavorites)}><Heart size={14} fill={showFavorites ? "currentColor" : "none"}/> Favoritos ({favoriteIds.length})</button><span className="results-summary">{filtered.length} {filtered.length === 1 ? 'negócio encontrado' : 'negócios encontrados'}{city ? ` em “${city}”` : ''}{hasActiveFilters && <button className="clear-city-filter" onClick={clearFilters}>Limpar filtros</button>}</span></div></div><div className="listing-grid">{loadingBusinesses ? <div className="empty-state">Carregando negócios cadastrados...</div> : filtered.length ? filtered.map((item,i)=>{const Icon=item.icon;return <article className="listing-card" key={item.id || item.name}><div className={'listing-visual visual-'+i}>{item.photos?.[0] ? <img className="listing-cover photo-selectable" src={item.photos[0]} alt={`Foto de ${item.name}`} loading="lazy" role="button" tabIndex={0} title="Clique para ampliar" onClick={()=>setSelectedPhoto({src:item.photos[0],name:item.name})} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedPhoto({src:item.photos[0],name:item.name})}}}/> : <Icon size={32} />}{item.logo && <img className="listing-logo photo-selectable" src={item.logo} alt={`Logo ${item.name}`} loading="lazy" role="button" tabIndex={0} title="Clique para ampliar" onClick={()=>setSelectedPhoto({src:item.logo,name:item.name+' — logo'})}/>}<span>{item.tag}</span><button className={favoriteIds.includes(String(item.id || item.name)) ? "listing-favorite saved" : "listing-favorite"} onClick={()=>toggleFavorite(item)} aria-label={favoriteIds.includes(String(item.id || item.name)) ? "Remover dos favoritos" : "Adicionar aos favoritos"} title={favoriteIds.includes(String(item.id || item.name)) ? "Remover dos favoritos" : "Adicionar aos favoritos"}><Heart size={17} fill={favoriteIds.includes(String(item.id || item.name)) ? "currentColor" : "none"}/></button>{item.featured && <strong className="listing-featured"><Star size={11} fill="currentColor"/> Destaque</strong>}</div>{item.photos?.length > 1 && <div className="listing-gallery">{item.photos.slice(1,5).map((url,index)=><img className="photo-selectable" key={url} src={url} alt={`Foto ${index+2} de ${item.name}`} loading="lazy" role="button" tabIndex={0} title="Clique para ampliar" onClick={()=>setSelectedPhoto({src:url,name:item.name})} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedPhoto({src:url,name:item.name})}}}/>)}</div>}<div className="listing-body"><small>{item.category}</small><h3>{item.name}</h3><p>{item.desc}</p><div className="listing-foot"><span><MapPin size={14}/>{item.city}</span><button className="listing-details-button" onClick={()=>openBusinessDetails(item)}>Ver detalhes</button>{whatsappLink(item.phone) ? <a className="listing-contact" href={whatsappLink(item.phone)} target="_blank" rel="noopener noreferrer" aria-label={`Conversar com ${item.name} pelo WhatsApp`}>WhatsApp <ArrowRight size={14}/></a> : <span className="coming">Contato não informado</span>}</div></div></article>}) : <div className="empty-state">{loadError || (isSupabaseConfigured ? 'Nenhum negócio encontrado com esses filtros.' : 'Nenhum resultado nesta prévia. Experimente outra categoria.')}{hasActiveFilters && <button className="reset-search-button" onClick={clearFilters}>Limpar filtros e ver todos</button>}</div>}</div></section>
      <section className="cta" id="sobre"><div className="cta-orb"></div><div><div className="eyebrow">FAÇA PARTE DESSA CONEXÃO</div><h2>Seu negócio merece<br/>ser encontrado.</h2><p>Dê visibilidade ao seu trabalho e conecte seu negócio a pessoas que procuram produtos e serviços na sua região.</p></div><button className="btn cta-btn" onClick={()=>{setShowForm(true);setSent(false)}}>Quero anunciar <ArrowRight size={17}/></button></section>
    </main>
    <footer><a className="brand footer-brand" href="#"><span className="brand-mark"><span></span><span></span><span></span></span><span>conecta<span className="brand-light">brasil</span><small>CONEXÕES QUE MOVIMENTAM</small></span></a><span>© 2026 Conecta Brasil. Um país inteiro de possibilidades.</span><span className="footer-status"><i></i> Conectando pessoas e negócios</span></footer>
    {selectedBusiness && <div className="business-detail-backdrop" role="dialog" aria-modal="true" aria-label={`Detalhes de ${selectedBusiness.name}`} onClick={closeBusinessDetails}><section className="business-detail" onClick={e=>e.stopPropagation()}><button className="business-detail-close" onClick={closeBusinessDetails} aria-label="Fechar detalhes"><X size={22}/></button><div className="business-detail-hero">{selectedBusiness.photos?.[0] ? <img src={selectedBusiness.photos[0]} alt={`Foto de ${selectedBusiness.name}`}/> : selectedBusiness.logo ? <img src={selectedBusiness.logo} alt={`Logo de ${selectedBusiness.name}`}/> : <Store size={46}/>}</div><div className="business-detail-content"><small>{selectedBusiness.category}</small><h2>{selectedBusiness.name}</h2>{selectedBusiness.featured && <strong className="detail-featured"><Star size={13} fill="currentColor"/> Negócio em destaque</strong>}<p>{selectedBusiness.desc}</p><div className="business-detail-location"><MapPin size={17}/>{selectedBusiness.city || 'Localização não informada'}</div>{selectedBusiness.photos?.length > 0 && <div className="business-detail-gallery">{selectedBusiness.photos.slice(0,5).map((url,index)=><img key={url} src={url} alt={`Foto ${index+1} de ${selectedBusiness.name}`} onClick={()=>setSelectedPhoto({src:url,name:selectedBusiness.name})}/>)}</div>}<div className="business-detail-actions">{whatsappLink(selectedBusiness.phone) && <a className="listing-contact business-detail-contact" href={whatsappLink(selectedBusiness.phone)} target="_blank" rel="noopener noreferrer">Conversar pelo WhatsApp <ArrowRight size={16}/></a>}<button className="business-share-button" onClick={()=>shareBusiness(selectedBusiness)}><Share2 size={16}/> Compartilhar negócio</button></div>{shareMessage && <small className="share-feedback">{shareMessage}</small>}{!whatsappLink(selectedBusiness.phone) && <span className="coming">Contato não informado</span>}</div></section></div>}
    {selectedPhoto && <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={`Foto ampliada de ${selectedPhoto.name}`} onClick={()=>setSelectedPhoto(null)}><button className="photo-lightbox-close" aria-label="Fechar imagem" onClick={()=>setSelectedPhoto(null)}><X size={24}/></button><div className="photo-lightbox-content" onClick={e=>e.stopPropagation()}><img src={selectedPhoto.src} alt={selectedPhoto.name}/><span>{selectedPhoto.name}</span></div></div>}
    {showForm && <div className="modal-backdrop" onClick={()=>setShowForm(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <button className="modal-close" onClick={()=>setShowForm(false)}><X/></button>
      {isAdmin ? <>
        <div className="eyebrow dark">ÁREA RESTRITA</div>
        <h2>Painel administrativo</h2>
        <p>Revise os anúncios enviados e escolha quais podem aparecer publicamente na vitrine.</p>
        <div className="admin-stats">
          <div><b>{adminBusinesses.length}</b><span>Cadastros</span></div>
          <div><b>{adminBusinesses.filter(item=>item.status==='pending').length}</b><span>Pendentes</span></div>
          <div><b>{adminBusinesses.filter(item=>item.status==='approved').length}</b><span>Aprovados</span></div>
          <div><b>{adminBusinesses.filter(item=>item.featured).length}</b><span>Em destaque</span></div>
        </div>
        <div className="admin-filters">{[['pending','Pendentes'],['approved','Aprovados'],['rejected','Rejeitados'],['suspended','Suspensos'],['all','Todos']].map(([value,label])=><button key={value} className={adminFilter===value?'active':''} onClick={()=>setAdminFilter(value)}>{label}</button>)}</div>
        <input className="admin-search" value={adminSearch} onChange={e=>setAdminSearch(e.target.value)} placeholder="Buscar por negócio, cidade ou telefone..." aria-label="Buscar cadastros" />
        {adminError && <div className="form-error">{adminError}</div>}
        {editingBusiness && <form className="admin-edit-form" onSubmit={saveBusinessEdit}>
          <h3>Editar anúncio</h3>
          <label>Nome<input required value={editingBusiness.name} onChange={e=>setEditingBusiness({...editingBusiness,name:e.target.value})}/></label>
          <label>Descrição<textarea rows="3" value={editingBusiness.description || ''} onChange={e=>setEditingBusiness({...editingBusiness,description:e.target.value})}/></label>
          <div className="form-row"><label>Cidade<input value={editingBusiness.city || ''} onChange={e=>setEditingBusiness({...editingBusiness,city:e.target.value})}/></label><label>UF<input maxLength="2" value={editingBusiness.state || ''} onChange={e=>setEditingBusiness({...editingBusiness,state:e.target.value.toUpperCase()})}/></label></div>
          <label>Telefone / WhatsApp<input value={editingBusiness.phone || ''} onChange={e=>setEditingBusiness({...editingBusiness,phone:e.target.value})}/></label>
          <div className="admin-actions"><button className="approve-action" disabled={formBusy}>Salvar alterações</button><button type="button" disabled={formBusy} onClick={()=>setEditingBusiness(null)}>Cancelar</button></div>
        </form>}
        {adminLoading ? <div className="empty-state">Carregando cadastros...</div> : <div className="admin-list">
          {adminBusinesses.filter(item=>(adminFilter==='all'||item.status===adminFilter) && [item.name,item.city,item.state,item.phone].filter(Boolean).join(' ').toLowerCase().includes(adminSearch.toLowerCase())).length ? adminBusinesses.filter(item=>(adminFilter==='all'||item.status===adminFilter) && [item.name,item.city,item.state,item.phone].filter(Boolean).join(' ').toLowerCase().includes(adminSearch.toLowerCase())).map(item=><article className="admin-business" key={item.id}>
            <div className="admin-business-head"><div><h3>{item.name}</h3><span>{item.business_type} · {[item.city,item.state].filter(Boolean).join('/')}</span></div><small className={'status-badge status-'+item.status}>{({pending:'Pendente',approved:'Aprovado',rejected:'Rejeitado',suspended:'Suspenso'})[item.status] || item.status}</small></div>
            <p>{item.description || 'Sem descrição informada.'}</p>
            {(item.logo_url || item.gallery_urls?.length) && <div className="admin-image-preview">{item.logo_url && <img src={item.logo_url} alt={`Logo ${item.name}`}/>} {(item.gallery_urls || []).map((url,index)=><img key={url} src={url} alt={`Foto ${index+1} de ${item.name}`}/>)}</div>}
            <div className="admin-meta"><span>{item.business_categories?.[0]?.categories?.name || 'Sem categoria'}</span>{item.phone && <span>{item.phone}</span>}<span>{new Date(item.created_at).toLocaleDateString('pt-BR')}</span></div>
            <div className="admin-actions">
              <button disabled={formBusy} onClick={()=>setEditingBusiness({...item})}>Editar anúncio</button>
              <button disabled={formBusy} className="delete-action" onClick={()=>deleteBusiness(item)}>Excluir definitivamente</button>
              <button disabled={formBusy} className={item.featured?'featured-action':''} onClick={()=>toggleFeatured(item)}>{item.featured?'Remover destaque':'Destacar anúncio'}</button>
              {item.status!=='approved' && <button disabled={formBusy} className="approve-action" onClick={()=>moderateBusiness(item.id,'approved')}>Aprovar</button>}
              {item.status!=='rejected' && <button disabled={formBusy} onClick={()=>moderateBusiness(item.id,'rejected')}>Rejeitar</button>}
              {item.status!=='suspended' && item.status==='approved' && <button disabled={formBusy} onClick={()=>moderateBusiness(item.id,'suspended')}>Suspender</button>}
              {item.status!=='pending' && <button disabled={formBusy} onClick={()=>moderateBusiness(item.id,'pending')}>Voltar para análise</button>}
            </div>
          </article>) : <div className="empty-state">Nenhum cadastro nesta categoria de status.</div>}
        </div>}
        <section className="admin-category-manager"><h3>Gerenciar categorias</h3><p>Cadastre novas categorias ou desative as que não devem aparecer no formulário de anunciantes.</p>
          <form onSubmit={addAdminCategory}><input value={newCategory} onChange={e=>setNewCategory(e.target.value)} maxLength="60" placeholder="Nome da nova categoria" required/><button className="approve-action" disabled={formBusy}>Adicionar</button></form>
          <div className="admin-category-list">{adminCategories.map(cat=><div key={cat.id}><span>{cat.name}<small>{cat.active?'Ativa':'Inativa'}</small></span><button disabled={formBusy} onClick={()=>toggleCategory(cat)}>{cat.active?'Desativar':'Ativar'}</button></div>)}</div>
        </section>
        <section className="admin-category-manager admin-audit"><h3>Histórico administrativo</h3><p>Últimas 100 ações realizadas no painel, com data e responsável.</p>
          {auditLoading ? <div className="empty-state">Carregando histórico...</div> : adminAuditLogs.length ? <div className="audit-list">{adminAuditLogs.map(log=><article className="audit-item" key={log.id}><div><b>{log.entity_name || log.entity_type}</b><span>{log.action} · {log.entity_type}</span></div><small>{log.actor_email || 'Administrador'}<br/>{new Date(log.created_at).toLocaleString('pt-BR')}</small></article>)}</div> : <div className="empty-state">Nenhuma ação registrada ainda.</div>}
          <button className="text-switch" disabled={auditLoading} onClick={loadAdminAuditLogs}>Atualizar histórico</button>
        </section>
        <button className="text-switch" onClick={async()=>{await supabase.auth.signOut();setAuthUser(null);setShowForm(false)}}>Sair da conta administrativa</button>
      </> : <>
      <div className="eyebrow dark">CADASTRO DE ANUNCIANTE</div>
      <h2>{authUser ? 'Apresente seu negócio.' : 'Entre para anunciar.'}</h2>
      {!isSupabaseConfigured ? <p>O cadastro está temporariamente indisponível. A conexão com o banco ainda não foi configurada na publicação.</p> : <>
        {formMessage && <div className="form-notice">{formMessage}</div>}
        {formError && <div className="form-error">{formError}</div>}
        {passwordRecovery ? <form onSubmit={updateRecoveredPassword} className="business-form">
          <div className="eyebrow dark">RECUPERAÇÃO DE ACESSO</div><h2>Crie uma nova senha.</h2>
          <p>Escolha uma senha com pelo menos 6 caracteres.</p>
          {formMessage && <div className="form-notice">{formMessage}</div>}
          {formError && <div className="form-error">{formError}</div>}
          <label>Nova senha<input type="password" required minLength="6" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Mínimo de 6 caracteres"/></label>
          <button className="btn modal-submit" disabled={formBusy}>{formBusy ? 'Salvando...' : 'Salvar nova senha'}</button>
        </form> : !authUser ? <>
          <p>{authMode === 'signup' ? 'Crie uma conta gratuita para cadastrar sua empresa ou serviço.' : 'Entre na sua conta para continuar.'}</p>
          <form onSubmit={handleAuthSubmit} className="business-form">
            <label>E-mail<input type="email" required value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="voce@email.com"/></label>
            <label>Senha<input type="password" required minLength="6" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="Mínimo de 6 caracteres"/></label>
            <button className="btn modal-submit" disabled={formBusy}>{formBusy ? 'Aguarde...' : authMode === 'signup' ? 'Criar conta' : 'Entrar'}</button>
          </form>
          <button className="text-switch" onClick={()=>{setAuthMode(authMode === 'signup' ? 'login' : 'signup');setFormError('');setFormMessage('')}}>{authMode === 'signup' ? 'Já tenho conta — entrar' : 'Não tenho conta — criar agora'}</button>
          {authMode === 'login' && <button type="button" className="text-switch" disabled={formBusy} onClick={requestPasswordRecovery}>Esqueci minha senha</button>}
        </> : <>
          <section className="owner-dashboard">
            <div className="owner-dashboard-head"><div><div className="eyebrow dark">ÁREA DO ANUNCIANTE</div><h3>Meus anúncios</h3><p>Acompanhe a situação dos seus cadastros.</p></div><button type="button" className="owner-refresh" onClick={loadOwnerBusinesses} disabled={ownerLoading}>Atualizar</button></div>
            {ownerError && <div className="form-error">{ownerError}</div>}
            {ownerLoading ? <div className="empty-state">Carregando seus anúncios...</div> : ownerBusinesses.length ? <div className="owner-list">{ownerBusinesses.map(item => <article className="owner-business" key={item.id}>
              <div className="owner-business-head"><div><b>{item.name}</b><small>{[item.city,item.state].filter(Boolean).join(' / ')} · {item.business_categories?.[0]?.categories?.name || 'Sem categoria'}</small></div><span className={'status-badge status-'+item.status}>{({pending:'Em análise',approved:'Aprovado',rejected:'Rejeitado',suspended:'Suspenso'})[item.status] || item.status}</span></div>
              <p>{item.description || 'Sem descrição informada.'}</p>
              <small className="owner-updated">Enviado em {new Date(item.created_at).toLocaleDateString('pt-BR')}{item.updated_at && item.updated_at !== item.created_at ? ` · Atualizado em ${new Date(item.updated_at).toLocaleDateString('pt-BR')}` : ''}</small>
              {['pending','approved'].includes(item.status) ? <><button type="button" className="owner-edit-button" onClick={() => setOwnerEditing({...item})}>Editar anúncio</button>{item.status === 'approved' && <small className="owner-status-help">Ao salvar, o anúncio ficará em análise até a equipe aprovar as alterações.</small>}</> : <small className="owner-status-help">{item.status === 'rejected' ? 'Entre em contato com a equipe para entender os ajustes necessários.' : 'Este anúncio não está visível na vitrine no momento.'}</small>}
            </article>)}</div> : <div className="empty-state">Você ainda não cadastrou nenhum negócio. Preencha o formulário abaixo para começar.</div>}
          </section>
          {ownerEditing && <form className="owner-edit-form business-form" onSubmit={saveOwnerBusiness}>
            <h3>Editar meu anúncio</h3>
            <label>Nome do negócio<input required maxLength="100" value={ownerEditing.name || ''} onChange={e=>setOwnerEditing({...ownerEditing,name:e.target.value})}/></label>
            <label>Tipo<select value={ownerEditing.business_type || 'empresa'} onChange={e=>setOwnerEditing({...ownerEditing,business_type:e.target.value})}><option value="empresa">Empresa</option><option value="profissional">Profissional</option><option value="loja">Loja / comércio</option><option value="servico">Prestador de serviço</option></select></label>
            <label>Descrição<textarea rows="3" maxLength="600" value={ownerEditing.description || ''} onChange={e=>setOwnerEditing({...ownerEditing,description:e.target.value})}/></label>
            <div className="form-row"><label>Cidade<input required value={ownerEditing.city || ''} onChange={e=>setOwnerEditing({...ownerEditing,city:e.target.value})}/></label><label>Estado (UF)<input required maxLength="2" value={ownerEditing.state || ''} onChange={e=>setOwnerEditing({...ownerEditing,state:e.target.value.toUpperCase()})}/></label></div>
            <label>Telefone / WhatsApp<input value={ownerEditing.phone || ''} onChange={e=>setOwnerEditing({...ownerEditing,phone:e.target.value})}/></label>
            <div className="admin-actions"><button className="btn modal-submit" disabled={formBusy}>{formBusy ? 'Salvando...' : 'Salvar alterações'}</button><button type="button" disabled={formBusy} onClick={()=>setOwnerEditing(null)}>Cancelar</button></div>
          </form>}
          <div className="owner-new-listing"><h3>Cadastrar outro negócio</h3><p>Seu novo anúncio ficará pendente até a aprovação da equipe.</p></div>
          <form onSubmit={handleBusinessSubmit} className="business-form">
            <label>Nome do negócio<input required maxLength="100" value={businessForm.name} onChange={e=>setBusinessForm({...businessForm,name:e.target.value})}/></label>
            <label>Tipo<select value={businessForm.business_type} onChange={e=>setBusinessForm({...businessForm,business_type:e.target.value})}><option value="empresa">Empresa</option><option value="profissional">Profissional</option><option value="loja">Loja / comércio</option><option value="servico">Prestador de serviço</option></select></label>
            <label>Descrição<textarea rows="3" maxLength="600" value={businessForm.description} onChange={e=>setBusinessForm({...businessForm,description:e.target.value})} placeholder="Conte brevemente o que você oferece."/></label>
            <label>Categoria<select value={businessForm.category_id} onChange={e=>setBusinessForm({...businessForm,category_id:e.target.value})}><option value="">Selecione uma categoria</option>{availableCategories.map(cat=><option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label>
            <div className="form-row"><label>Cidade<input required value={businessForm.city} onChange={e=>setBusinessForm({...businessForm,city:e.target.value})}/></label><label>Estado (UF)<input required maxLength="2" value={businessForm.state} onChange={e=>setBusinessForm({...businessForm,state:e.target.value.toUpperCase()})}/></label></div>
            <label>Telefone / WhatsApp<input value={businessForm.phone} onChange={e=>setBusinessForm({...businessForm,phone:e.target.value})}/></label>
            <label>Logo da empresa<input type="file" accept="image/*" onChange={e=>setLogoFile(e.target.files?.[0] || null)}/><small className="upload-help">Uma imagem, até 5 MB.</small></label>
            <label>Fotos do negócio (até 5)<input type="file" accept="image/*" multiple onChange={e=>setGalleryFiles(Array.from(e.target.files || []).slice(0,5))}/><small className="upload-help">Selecione até 5 fotos. Cada arquivo pode ter no máximo 5 MB.</small></label>
            {galleryFiles.length > 0 && <div className="selected-files">{galleryFiles.map(file=><span key={file.name}>{file.name}</span>)}</div>}
            <button className="btn modal-submit" disabled={formBusy}>{formBusy ? 'Enviando...' : 'Enviar para aprovação'}</button>
          </form>
          <button className="text-switch" onClick={async()=>{await supabase.auth.signOut();setAuthUser(null);setFormMessage('')}}>Sair da conta</button>
        </>}
      </>}
      </>}
    </div></div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);