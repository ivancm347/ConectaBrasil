import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, MapPin, Store, Wrench, ShoppingBag, Heart, ArrowRight, Menu, X, Plus, ShieldCheck, Sparkles, Building2, Star } from 'lucide-react';
import './style.css';

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
  const filtered = useMemo(() => examples.filter(item => (active === 'Todas' || item.category === active) && (item.name + item.desc + item.category).toLowerCase().includes(query.toLowerCase())), [query, active]);
  return <div className="app">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark"><span></span><span></span><span></span></span><span>conecta<span className="brand-light">brasil</span><small>CONEXÕES QUE MOVIMENTAM</small></span></a>
      <button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label="Abrir menu">{menu ? <X/> : <Menu/>}</button>
      <nav className={menu ? 'nav open' : 'nav'}><a href="#categorias" onClick={()=>setMenu(false)}>Categorias</a><a href="#explorar" onClick={()=>setMenu(false)}>Explorar</a><a href="#sobre" onClick={()=>setMenu(false)}>Sobre</a><button className="btn btn-small" onClick={()=>{setShowForm(true);setMenu(false)}}><Plus size={16}/> Anunciar negócio</button></nav>
    </header>
    <main>
      <section className="hero"><div className="hero-glow"></div><div className="hero-content"><div className="eyebrow"><Sparkles size={15}/> UM BRASIL DE OPORTUNIDADES</div><h1>O que você procura.<br/><em>Mais perto de você.</em></h1><p>Encontre empresas, profissionais, lojas e serviços. Valorize quem faz a economia acontecer em cada cidade do Brasil.</p>
        <div className="search-panel"><label className="search-field"><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="O que você está procurando?"/></label><span className="search-divider"></span><label className="search-field city-field"><MapPin size={20}/><input value={city} onChange={e=>setCity(e.target.value)} placeholder="Cidade ou região"/></label><button className="btn search-btn" onClick={()=>document.getElementById('explorar').scrollIntoView({behavior:'smooth'})}>Buscar <ArrowRight size={17}/></button></div>
        <div className="hero-note"><ShieldCheck size={15}/> Uma plataforma para conectar pessoas e negócios.</div>
      </div><div className="hero-art"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="map-card"><div className="map-lines"></div><div className="pin pin-a"><MapPin/></div><div className="pin pin-b"><MapPin/></div><div className="pin pin-c"><MapPin/></div><div className="map-center"><span>BR</span><b>Brasil</b><small>Grandes conexões começam localmente</small></div></div><div className="float-card float-top"><span className="float-icon"><Store/></span><span><b>Negócios locais</b><small>Ganham visibilidade</small></span></div><div className="float-card float-bottom"><span className="float-icon green"><Heart/></span><span><b>Comunidade forte</b><small>Todo mundo conectado</small></span></div></div></section>
      <section className="trust-strip"><div><b>1 só lugar</b><span>para encontrar</span></div><i></i><div><b>Seu município</b><span>como ponto de partida</span></div><i></i><div><b>Todo o Brasil</b><span>como horizonte</span></div></section>
      <section className="section categories" id="categorias"><div className="section-heading"><div><div className="eyebrow dark">EXPLORE POSSIBILIDADES</div><h2>O Brasil tem de tudo.<br/><em>Encontre aqui.</em></h2></div><p>Uma vitrine para negócios de todos os tamanhos e uma busca simples para quem precisa encontrar soluções.</p></div><div className="category-grid">{categories.map(({name,icon:Icon,count},i)=><button className="category-card" key={name} onClick={()=>{setActive(name);document.getElementById('explorar').scrollIntoView({behavior:'smooth'})}}><span className={'cat-icon cat-'+i}><Icon size={23}/></span><b>{name}</b><small>{count}</small><ArrowRight className="cat-arrow" size={18}/></button>)}</div></section>
      <section className="explore-section" id="explorar"><div className="section-heading explore-heading"><div><div className="eyebrow dark">VITRINE CONECTA BRASIL</div><h2>Descubra o que existe <em>por perto.</em></h2></div><span className="demo-label">PRÉVIA DA PLATAFORMA</span></div><div className="filters"><div className="filter-pills">{['Todas',...categories.map(c=>c.name)].map(c=><button key={c} className={active===c?'selected':''} onClick={()=>setActive(c)}>{c}</button>)}</div><span>{city ? 'Localização informada: '+city : 'Começando pela sua região'}</span></div><div className="listing-grid">{filtered.length ? filtered.map((item,i)=>{const Icon=item.icon;return <article className="listing-card" key={item.name}><div className={'listing-visual visual-'+i}><Icon size={32}/><span>{item.tag}</span></div><div className="listing-body"><small>{item.category}</small><h3>{item.name}</h3><p>{item.desc}</p><div className="listing-foot"><span><MapPin size={14}/>{item.city}</span><span className="coming">Cadastro em breve</span></div></div></article>}) : <div className="empty-state">Nenhum resultado nesta prévia. Experimente outra categoria.</div>}</div></section>
      <section className="cta" id="sobre"><div className="cta-orb"></div><div><div className="eyebrow">FAÇA PARTE DESSA CONEXÃO</div><h2>Seu negócio merece<br/>ser encontrado.</h2><p>Estamos preparando uma nova vitrine para empresas e profissionais de todo o Brasil.</p></div><button className="btn cta-btn" onClick={()=>{setShowForm(true);setSent(false)}}>Quero anunciar <ArrowRight size={17}/></button></section>
    </main>
    <footer><a className="brand footer-brand" href="#"><span className="brand-mark"><span></span><span></span><span></span></span><span>conecta<span className="brand-light">brasil</span><small>CONEXÕES QUE MOVIMENTAM</small></span></a><span>© 2026 Conecta Brasil. Um país inteiro de possibilidades.</span><span className="footer-status"><i></i> Projeto em construção</span></footer>
    {showForm && <div className="modal-backdrop" onClick={()=>setShowForm(false)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowForm(false)}><X/></button>{sent ? <><div className="success-icon"><ShieldCheck/></div><h2>Obrigado pelo interesse!</h2><p>O cadastro de anunciantes será liberado na próxima etapa do projeto.</p><button className="btn modal-submit" onClick={()=>setShowForm(false)}>Fechar</button></> : <><div className="eyebrow dark">CADASTRO DE INTERESSE</div><h2>Traga seu negócio<br/>para o Conecta Brasil.</h2><p>Estamos preparando o cadastro de empresas e profissionais. Em breve você poderá criar sua página e divulgar seus serviços.</p><div className="modal-preview"><Building2/><span><b>Cadastro de anunciantes</b><small>Será disponibilizado na próxima fase.</small></span></div><button className="btn modal-submit" onClick={()=>setSent(true)}>Entendi <ArrowRight size={17}/></button></>}</div></div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);