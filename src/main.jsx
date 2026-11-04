import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, MapPin, Store, Wrench, ShoppingBag, Heart, ArrowRight, Menu, X, Plus, ShieldCheck, Sparkles, Building2, Star } from 'lucide-react';
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
  const [availableCategories, setAvailableCategories] = useState([]);
  const [businessForm, setBusinessForm] = useState({ name: '', description: '', business_type: 'empresa', phone: '', city: '', state: '', category_id: '' });
  const [formBusy, setFormBusy] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [adminBusinesses, setAdminBusinesses] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminFilter, setAdminFilter] = useState('pending');
  const [adminError, setAdminError] = useState('');
  const isAdmin = authUser?.app_metadata?.role === 'admin';

  async function loadAdminBusinesses() {
    if (!isAdmin) return;
    setAdminLoading(true); setAdminError('');
    const { data, error } = await supabase.from('businesses')
      .select('id,name,description,business_type,phone,city,state,status,created_at,business_categories(categories(name))')
      .order('created_at', { ascending: false });
    if (error) setAdminError('Não foi possível carregar os cadastros. Confira se sua conta tem permissão de administrador.');
    else setAdminBusinesses(data || []);
    setAdminLoading(false);
  }

  async function moderateBusiness(id, status) {
    setFormBusy(true); setAdminError('');
    const { error } = await supabase.from('businesses').update({ status }).eq('id', id);
    if (error) setAdminError('Não foi possível atualizar este cadastro: ' + error.message);
    else {
      setAdminBusinesses(items => items.map(item => item.id === id ? { ...item, status } : item));
      if (status === 'approved') {
        const { data } = await supabase.from('businesses')
          .select('id,name,description,business_type,city,state,business_categories(categories(name))')
          .eq('status', 'approved').order('featured', { ascending: false }).order('name');
        if (data) setBusinesses(data.map(item => ({
          id: item.id, name: item.name,
          category: item.business_categories?.[0]?.categories?.name || 'Empresas',
          city: [item.city, item.state].filter(Boolean).join(' - '),
          desc: item.description || 'Conheça este negócio cadastrado no Conecta Brasil.',
          tag: item.business_type || 'Negócio', icon: Store
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
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => setAuthUser(session?.user || null));
    supabase.from('categories').select('id,name').eq('active', true).order('name')
      .then(({ data }) => setAvailableCategories(data || []));
    return () => authListener.subscription.unsubscribe();
  }, []);

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
      const slugBase = businessForm.name.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const slug = slugBase + '-' + crypto.randomUUID().slice(0, 8);
      const { data, error } = await supabase.from('businesses').insert({
        owner_id: authUser.id, name: businessForm.name.trim(), slug,
        description: businessForm.description.trim(), business_type: businessForm.business_type,
        phone: businessForm.phone.trim(), city: businessForm.city.trim(),
        state: businessForm.state.trim().toUpperCase(), status: 'pending', featured: false
      }).select('id').single();
      if (error) throw error;
      if (businessForm.category_id) {
        const { error: categoryError } = await supabase.from('business_categories').insert({
          business_id: data.id, category_id: businessForm.category_id
        });
        if (categoryError) throw categoryError;
      }
      setFormMessage('Cadastro enviado para análise! Seu negócio aparecerá na vitrine depois da aprovação.');
      setBusinessForm({ name: '', description: '', business_type: 'empresa', phone: '', city: '', state: '', category_id: '' });
    } catch (error) { setFormError(error.message || 'Não foi possível enviar o cadastro.'); }
    finally { setFormBusy(false); }
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let alive = true;
    supabase
      .from('businesses')
      .select('id,name,description,business_type,city,state,business_categories(categories(name))')
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
          icon: Store,
        })));
        setLoadingBusinesses(false);
      });
    return () => { alive = false; };
  }, []);

  const listingSource = isSupabaseConfigured ? businesses : examples;
  const filtered = useMemo(() => listingSource.filter(item =>
    (active === 'Todas' || item.category === active) &&
    (item.name + item.desc + item.category + item.city).toLowerCase().includes(query.toLowerCase()) &&
    (!city || item.city.toLowerCase().includes(city.toLowerCase()))
  ), [listingSource, query, active, city]);
  return <div className="app">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark"><span></span><span></span><span></span></span><span>conecta<span className="brand-light">brasil</span><small>CONEXÕES QUE MOVIMENTAM</small></span></a>
      <button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label="Abrir menu">{menu ? <X/> : <Menu/>}</button>
      <nav className={menu ? 'nav open' : 'nav'}><a href="#categorias" onClick={()=>setMenu(false)}>Categorias</a><a href="#explorar" onClick={()=>setMenu(false)}>Explorar</a><a href="#sobre" onClick={()=>setMenu(false)}>Sobre</a>{isAdmin && <button className="btn btn-small admin-nav" onClick={()=>{setShowForm(true);setMenu(false)}}><ShieldCheck size={16}/> Administração</button>}<button className="btn btn-small" onClick={()=>{setShowForm(true);setMenu(false)}}><Plus size={16}/> Anunciar negócio</button></nav>
    </header>
    <main>
      <section className="hero"><div className="hero-glow"></div><div className="hero-content"><div className="eyebrow"><Sparkles size={15}/> UM BRASIL DE OPORTUNIDADES</div><h1>O que você procura.<br/><em>Mais perto de você.</em></h1><p>Encontre empresas, profissionais, lojas e serviços. Valorize quem faz a economia acontecer em cada cidade do Brasil.</p>
        <div className="search-panel"><label className="search-field"><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="O que você está procurando?"/></label><span className="search-divider"></span><label className="search-field city-field"><MapPin size={20}/><input value={city} onChange={e=>setCity(e.target.value)} placeholder="Cidade ou região"/></label><button className="btn search-btn" onClick={()=>document.getElementById('explorar').scrollIntoView({behavior:'smooth'})}>Buscar <ArrowRight size={17}/></button></div>
        <div className="hero-note"><ShieldCheck size={15}/> Uma plataforma para conectar pessoas e negócios.</div>
      </div><div className="hero-art"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="map-card"><div className="map-lines"></div><div className="pin pin-a"><MapPin/></div><div className="pin pin-b"><MapPin/></div><div className="pin pin-c"><MapPin/></div><div className="map-center"><span>BR</span><b>Brasil</b><small>Grandes conexões começam localmente</small></div></div><div className="float-card float-top"><span className="float-icon"><Store/></span><span><b>Negócios locais</b><small>Ganham visibilidade</small></span></div><div className="float-card float-bottom"><span className="float-icon green"><Heart/></span><span><b>Comunidade forte</b><small>Todo mundo conectado</small></span></div></div></section>
      <section className="trust-strip"><div><b>1 só lugar</b><span>para encontrar</span></div><i></i><div><b>Seu município</b><span>como ponto de partida</span></div><i></i><div><b>Todo o Brasil</b><span>como horizonte</span></div></section>
      <section className="section categories" id="categorias"><div className="section-heading"><div><div className="eyebrow dark">EXPLORE POSSIBILIDADES</div><h2>O Brasil tem de tudo.<br/><em>Encontre aqui.</em></h2></div><p>Uma vitrine para negócios de todos os tamanhos e uma busca simples para quem precisa encontrar soluções.</p></div><div className="category-grid">{categories.map(({name,icon:Icon,count},i)=><button className="category-card" key={name} onClick={()=>{setActive(name);document.getElementById('explorar').scrollIntoView({behavior:'smooth'})}}><span className={'cat-icon cat-'+i}><Icon size={23}/></span><b>{name}</b><small>{count}</small><ArrowRight className="cat-arrow" size={18}/></button>)}</div></section>
      <section className="explore-section" id="explorar"><div className="section-heading explore-heading"><div><div className="eyebrow dark">VITRINE CONECTA BRASIL</div><h2>Descubra o que existe <em>por perto.</em></h2></div><span className="demo-label">PRÉVIA DA PLATAFORMA</span></div><div className="filters"><div className="filter-pills">{['Todas',...categories.map(c=>c.name)].map(c=><button key={c} className={active===c?'selected':''} onClick={()=>setActive(c)}>{c}</button>)}</div><span>{city ? 'Localização informada: '+city : 'Começando pela sua região'}</span></div><div className="listing-grid">{loadingBusinesses ? <div className="empty-state">Carregando negócios cadastrados...</div> : filtered.length ? filtered.map((item,i)=>{const Icon=item.icon;return <article className="listing-card" key={item.name}><div className={'listing-visual visual-'+i}><Icon size={32}/><span>{item.tag}</span></div><div className="listing-body"><small>{item.category}</small><h3>{item.name}</h3><p>{item.desc}</p><div className="listing-foot"><span><MapPin size={14}/>{item.city}</span><span className="coming">Cadastro em breve</span></div></div></article>}) : <div className="empty-state">{loadError || (isSupabaseConfigured ? 'Ainda não há negócios aprovados nesta busca.' : 'Nenhum resultado nesta prévia. Experimente outra categoria.')}</div>}</div></section>
      <section className="cta" id="sobre"><div className="cta-orb"></div><div><div className="eyebrow">FAÇA PARTE DESSA CONEXÃO</div><h2>Seu negócio merece<br/>ser encontrado.</h2><p>Estamos preparando uma nova vitrine para empresas e profissionais de todo o Brasil.</p></div><button className="btn cta-btn" onClick={()=>{setShowForm(true);setSent(false)}}>Quero anunciar <ArrowRight size={17}/></button></section>
    </main>
    <footer><a className="brand footer-brand" href="#"><span className="brand-mark"><span></span><span></span><span></span></span><span>conecta<span className="brand-light">brasil</span><small>CONEXÕES QUE MOVIMENTAM</small></span></a><span>© 2026 Conecta Brasil. Um país inteiro de possibilidades.</span><span className="footer-status"><i></i> Projeto em construção</span></footer>
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
        </div>
        <div className="admin-filters">{[['pending','Pendentes'],['approved','Aprovados'],['rejected','Rejeitados'],['suspended','Suspensos'],['all','Todos']].map(([value,label])=><button key={value} className={adminFilter===value?'active':''} onClick={()=>setAdminFilter(value)}>{label}</button>)}</div>
        {adminError && <div className="form-error">{adminError}</div>}
        {adminLoading ? <div className="empty-state">Carregando cadastros...</div> : <div className="admin-list">
          {adminBusinesses.filter(item=>adminFilter==='all'||item.status===adminFilter).length ? adminBusinesses.filter(item=>adminFilter==='all'||item.status===adminFilter).map(item=><article className="admin-business" key={item.id}>
            <div className="admin-business-head"><div><h3>{item.name}</h3><span>{item.business_type} · {[item.city,item.state].filter(Boolean).join('/')}</span></div><small className={'status-badge status-'+item.status}>{({pending:'Pendente',approved:'Aprovado',rejected:'Rejeitado',suspended:'Suspenso'})[item.status] || item.status}</small></div>
            <p>{item.description || 'Sem descrição informada.'}</p>
            <div className="admin-meta"><span>{item.business_categories?.[0]?.categories?.name || 'Sem categoria'}</span>{item.phone && <span>{item.phone}</span>}<span>{new Date(item.created_at).toLocaleDateString('pt-BR')}</span></div>
            <div className="admin-actions">
              {item.status!=='approved' && <button disabled={formBusy} className="approve-action" onClick={()=>moderateBusiness(item.id,'approved')}>Aprovar</button>}
              {item.status!=='rejected' && <button disabled={formBusy} onClick={()=>moderateBusiness(item.id,'rejected')}>Rejeitar</button>}
              {item.status!=='suspended' && item.status==='approved' && <button disabled={formBusy} onClick={()=>moderateBusiness(item.id,'suspended')}>Suspender</button>}
              {item.status!=='pending' && <button disabled={formBusy} onClick={()=>moderateBusiness(item.id,'pending')}>Voltar para análise</button>}
            </div>
          </article>) : <div className="empty-state">Nenhum cadastro nesta categoria de status.</div>}
        </div>}
        <button className="text-switch" onClick={async()=>{await supabase.auth.signOut();setAuthUser(null);setShowForm(false)}}>Sair da conta administrativa</button>
      </> : <>
      <div className="eyebrow dark">CADASTRO DE ANUNCIANTE</div>
      <h2>{authUser ? 'Apresente seu negócio.' : 'Entre para anunciar.'}</h2>
      {!isSupabaseConfigured ? <p>O cadastro está temporariamente indisponível. A conexão com o banco ainda não foi configurada na publicação.</p> : <>
        {formMessage && <div className="form-notice">{formMessage}</div>}
        {formError && <div className="form-error">{formError}</div>}
        {!authUser ? <>
          <p>{authMode === 'signup' ? 'Crie uma conta gratuita para cadastrar sua empresa ou serviço.' : 'Entre na sua conta para continuar.'}</p>
          <form onSubmit={handleAuthSubmit} className="business-form">
            <label>E-mail<input type="email" required value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="voce@email.com"/></label>
            <label>Senha<input type="password" required minLength="6" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="Mínimo de 6 caracteres"/></label>
            <button className="btn modal-submit" disabled={formBusy}>{formBusy ? 'Aguarde...' : authMode === 'signup' ? 'Criar conta' : 'Entrar'}</button>
          </form>
          <button className="text-switch" onClick={()=>{setAuthMode(authMode === 'signup' ? 'login' : 'signup');setFormError('');setFormMessage('')}}>{authMode === 'signup' ? 'Já tenho conta — entrar' : 'Não tenho conta — criar agora'}</button>
        </> : <>
          <p>Preencha os dados. Seu anúncio ficará pendente até a aprovação da equipe.</p>
          <form onSubmit={handleBusinessSubmit} className="business-form">
            <label>Nome do negócio<input required maxLength="100" value={businessForm.name} onChange={e=>setBusinessForm({...businessForm,name:e.target.value})}/></label>
            <label>Tipo<select value={businessForm.business_type} onChange={e=>setBusinessForm({...businessForm,business_type:e.target.value})}><option value="empresa">Empresa</option><option value="profissional">Profissional</option><option value="loja">Loja / comércio</option><option value="servico">Prestador de serviço</option></select></label>
            <label>Descrição<textarea rows="3" maxLength="600" value={businessForm.description} onChange={e=>setBusinessForm({...businessForm,description:e.target.value})} placeholder="Conte brevemente o que você oferece."/></label>
            <label>Categoria<select value={businessForm.category_id} onChange={e=>setBusinessForm({...businessForm,category_id:e.target.value})}><option value="">Selecione uma categoria</option>{availableCategories.map(cat=><option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label>
            <div className="form-row"><label>Cidade<input required value={businessForm.city} onChange={e=>setBusinessForm({...businessForm,city:e.target.value})}/></label><label>Estado (UF)<input required maxLength="2" value={businessForm.state} onChange={e=>setBusinessForm({...businessForm,state:e.target.value.toUpperCase()})}/></label></div>
            <label>Telefone / WhatsApp<input value={businessForm.phone} onChange={e=>setBusinessForm({...businessForm,phone:e.target.value})}/></label>
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