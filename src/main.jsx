import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, MapPin, Store, Wrench, ShoppingBag, Heart, ArrowRight, Menu, X, Plus, ShieldCheck, Sparkles, Building2, Star, Share2, Download, Mic, LocateFixed } from 'lucide-react';
import './style.css';
import '../public/image-fit.css';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { getMarketFromPath, getMarketPath, getMarketStorageKey } from './lib/market';
import QRCode from 'qrcode';

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
const paginationTestListings = Array.from({ length: 13 }, (_, index) => {
  const categoryOptions = [
    { category: 'Casa e construção', icon: Building2 },
    { category: 'Serviços profissionais', icon: Wrench },
    { category: 'Lojas e comércio', icon: ShoppingBag },
    { category: 'Empresas', icon: Store },
  ];
  const option = categoryOptions[index % categoryOptions.length];
  return {
    id: `teste-paginacao-${index + 1}`,
    name: `ANÚNCIO FICTÍCIO ${String(index + 1).padStart(2, '0')}`,
    category: option.category,
    city: 'Itanhaém',
    desc: 'Cadastro demonstrativo criado exclusivamente para testar a navegação da vitrine. Este negócio não existe.',
    tag: 'TESTE — NÃO É NEGÓCIO REAL',
    icon: option.icon,
    isPaginationTest: true,
  };
});
function LocationFields({ item, onChange }) {
  const visibility = item.location_visibility || 'neighborhood';
  return <section className="location-fields">
    <h4>Localização do anúncio</h4>
    <label>Como deseja mostrar sua localização?
      <select value={visibility} onChange={e=>onChange({location_visibility:e.target.value})}>
        <option value="exact">Endereço comercial completo</option>
        <option value="neighborhood">Somente bairro e cidade</option>
        <option value="service_area">Área de atendimento (várias localidades)</option>
      </select>
    </label>
    {visibility === 'exact' && <>
      <div className="form-row"><label>CEP<input inputMode="numeric" autoComplete="postal-code" maxLength="9" placeholder="00000-000" value={item.postal_code || ''} onChange={e=>onChange({postal_code:e.target.value.replace(/[^0-9-]/g,'')})}/></label><label>Bairro<input maxLength="100" autoComplete="address-level3" value={item.neighborhood || ''} onChange={e=>onChange({neighborhood:e.target.value})}/></label></div>
      <label>Rua / Avenida<input maxLength="150" autoComplete="address-line1" value={item.street || ''} onChange={e=>onChange({street:e.target.value})}/></label>
      <div className="form-row"><label>Número<input maxLength="20" value={item.street_number || ''} onChange={e=>onChange({street_number:e.target.value})}/></label><label>Complemento (opcional)<input maxLength="100" autoComplete="address-line2" value={item.address_complement || ''} onChange={e=>onChange({address_complement:e.target.value})}/></label></div>
      <small>O endereço completo ficará visível no perfil público. Use esta opção somente para endereço comercial.</small>
    </>}
    {visibility === 'neighborhood' && <label>Bairro (opcional)<input maxLength="100" autoComplete="address-level3" value={item.neighborhood || ''} onChange={e=>onChange({neighborhood:e.target.value})}/></label>}
    {visibility === 'service_area' && <label>Cidades ou regiões atendidas (separe por vírgulas)<input maxLength="300" placeholder="Ex.: Itanhaém, Mongaguá, Peruíbe" value={item.service_cities || ''} onChange={e=>onChange({service_cities:e.target.value})}/></label>}
  </section>;
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function whatsappLink(phone, messageText = 'Olá! Encontrei seu negócio no Conecta Brasil e gostaria de mais informações.') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const number = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(messageText)}`;
}

function businessMapLink(item) {
  const visibility = item.location_visibility || 'neighborhood';
  const serviceCities = String(item.service_cities || '').split(',').map(value => value.trim()).filter(Boolean);
  const search = visibility === 'exact'
    ? [item.street, item.street_number, item.address_complement, item.neighborhood, item.postal_code, item.city, item.state, 'Brasil']
    : visibility === 'service_area'
      ? [...serviceCities, item.city, item.state, 'Brasil']
      : [item.neighborhood, item.city, item.state, 'Brasil'];
  const query = search.filter(Boolean).join(', ');
  return query ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}` : '';
}

function businessDirectionsLink(item) {
  const visibility = item.location_visibility || 'neighborhood';
  // Só oferece rota para um endereço ou bairro identificável. Área de atendimento
  // pode abranger várias cidades e não deve gerar uma rota enganosa.
  if (visibility === 'service_area') return '';
  const destination = visibility === 'exact'
    ? [item.street, item.street_number, item.address_complement, item.neighborhood, item.city, item.state, item.postal_code, 'Brasil']
    : [item.neighborhood, item.city, item.state, 'Brasil'];
  const query = destination.filter(Boolean).join(', ');
  return query ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}&travelmode=driving` : '';
}

const searchSynonyms = {
  pedreiro: ['construção', 'reforma', 'alvenaria', 'obra'],
  eletricista: ['elétrica', 'instalação', 'manutenção'],
  encanador: ['hidráulica', 'vazamento', 'tubulação'],
  pintor: ['pintura', 'reforma', 'acabamento'],
  gesseiro: ['gesso', 'drywall', 'forro', 'sanca', 'divisória'],
  gesso: ['gesseiro', 'drywall', 'forro', 'rebaixo', 'sanca'],
  instalador: ['instalação', 'montagem', 'manutenção'],
  montador: ['montagem', 'móveis', 'instalação'],
  drywall: ['gesso', 'forro', 'divisória', 'parede'],
  forro: ['gesso', 'drywall', 'rebaixo', 'sanca'],
  mecanico: ['mecânica', 'oficina', 'automóvel', 'carro'],
  dentista: ['odontologia', 'saúde', 'clínica'],
  advogado: ['advocacia', 'jurídico', 'direito'],
  diarista: ['limpeza', 'faxina', 'doméstica'],
  manicure: ['unhas', 'beleza', 'estética'],
  mercado: ['mercearia', 'alimentos', 'supermercado'],
  restaurante: ['comida', 'alimentação', 'lanchonete'],
};

// Palavras de ligação não devem impedir resultados em buscas como “loja de material”.
const searchStopWords = new Set(['a','as','o','os','um','uma','uns','umas','de','do','da','dos','das','e','em','no','na','nos','nas','para','por','com','sem','ao','aos']);

function expandSearchQuery(value) {
  const normalized = normalizeSearch(value);
  const terms = normalized.split(/\s+/).filter(Boolean);
  const expanded = new Set(terms);
  terms.forEach(term => (searchSynonyms[term] || []).forEach(alias => expanded.add(normalizeSearch(alias))));
  return [...expanded].join(' ');
}

function getBusinessImagePath(value) {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    const marker = '/storage/v1/object/public/business-images/';
    const signedMarker = '/storage/v1/object/sign/business-images/';
    const index = url.pathname.indexOf(marker);
    const signedIndex = url.pathname.indexOf(signedMarker);
    if (index >= 0) return decodeURIComponent(url.pathname.slice(index + marker.length));
    if (signedIndex >= 0) return decodeURIComponent(url.pathname.slice(signedIndex + signedMarker.length));
    return null;
  } catch { return null; }
}

async function createBusinessImageUrl(value) {
  const path = getBusinessImagePath(value);
  if (!path) return '';
  // O bucket permanece privado. A URL assinada permite exibir apenas arquivos
  // que a política do Storage autoriza (anúncios aprovados, proprietário ou admin).
  const { data, error } = await supabase.storage
    .from('business-images')
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) {
    console.warn('Não foi possível gerar URL temporária para imagem do negócio:', error.message);
    return '';
  }
  return data?.signedUrl || '';
}

async function fetchPublicBusinesses(market) {
  let result = await supabase.from('businesses')
    .select('id,name,description,business_type,phone,city,state,postal_code,street,street_number,neighborhood,address_complement,location_visibility,service_cities,logo_url,gallery_urls,featured,featured_expires_at,plan_type,plan_started_at,plan_expires_at,verified,business_categories(categories(name))')
    .eq('status', 'approved').eq('country', market.legacyCountry).order('featured', { ascending: false }).order('name', { ascending: true });
  // Compatibilidade com projetos que ainda não executaram as migrações opcionais.
  if (result.error && /postal_code|street_number|address_complement|location_visibility|service_cities|column/i.test(result.error.message || '')) {
    result = await supabase.from('businesses')
      .select('id,name,description,business_type,phone,city,state,logo_url,gallery_urls,featured,featured_expires_at,plan_type,plan_started_at,plan_expires_at,verified,business_categories(categories(name))')
      .eq('status', 'approved').eq('country', market.legacyCountry).order('featured', { ascending: false }).order('name', { ascending: true });
  }
  if (result.error && /verified|column/i.test(result.error.message || '')) {
    result = await supabase.from('businesses')
      .select('id,name,description,business_type,phone,city,state,logo_url,gallery_urls,featured,business_categories(categories(name))')
      .eq('status', 'approved').eq('country', market.legacyCountry).order('featured', { ascending: false }).order('name', { ascending: true });
  }
  const { data, error } = result;
  if (error) throw error;
  const businesses = await Promise.all((data || []).map(async item => {
    const now = Date.now();
    const planExpiresAt = item.plan_expires_at || item.featured_expires_at || null;
    const planActive = !planExpiresAt || new Date(planExpiresAt).getTime() > now;
    const featuredActive = Boolean(item.featured) && planActive &&
      (!item.featured_expires_at || new Date(item.featured_expires_at).getTime() > now);
    return {
      id: item.id,
      name: item.name,
      category: item.business_categories?.[0]?.categories?.name || 'Empresas',
      city: [item.city, item.state].filter(Boolean).join(' - '),
      desc: item.description || 'Conheça este negócio cadastrado no Conecta Brasil.',
      tag: item.business_type || 'Negócio',
      featured: featuredActive,
      planType: planActive ? (item.plan_type || (item.featured ? 'destaque' : 'gratuito')) : 'gratuito',
      planExpiresAt,
      verified: Boolean(item.verified),
      phone: item.phone || '',
      postal_code: item.postal_code || '',
      street: item.street || '',
      street_number: item.street_number || '',
      neighborhood: item.neighborhood || '',
      address_complement: item.address_complement || '',
      location_visibility: item.location_visibility || 'neighborhood',
      service_cities: item.service_cities || '',
      icon: Store,
      logo: await createBusinessImageUrl(item.logo_url),
      photos: (await Promise.all((item.gallery_urls || []).map(createBusinessImageUrl))).filter(Boolean),
    };
  }));
  try {
    localStorage.setItem(getMarketStorageKey('public-businesses'), JSON.stringify(businesses.map(({ icon, ...item }) => item)));
  } catch { /* A vitrine continua funcionando mesmo se o armazenamento local estiver cheio. */ }
  return businesses;
}

function readCachedPublicBusinesses() {
  try {
    const saved = JSON.parse(localStorage.getItem(getMarketStorageKey('public-businesses')) || '[]');
    if (!Array.isArray(saved)) return [];
    const now = Date.now();
    return saved.filter(item => item && item.id && item.name).map(item => {
      const expiresAt = item.planExpiresAt || item.plan_expires_at || item.featured_expires_at || null;
      const planActive = !expiresAt || new Date(expiresAt).getTime() > now;
      return {
        ...item,
        featured: Boolean(item.featured) && planActive,
        planType: planActive ? (item.planType || item.plan_type || 'gratuito') : 'gratuito',
        planExpiresAt: expiresAt,
        icon: Store,
      };
    });
  } catch {
    return [];
  }
}

function App({ market }) {
  const [query, setQuery] = useState('');
  const [voiceMessage, setVoiceMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [nearbyMapUrl, setNearbyMapUrl] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [listingPage, setListingPage] = useState(1);
  const listingPageSize = 12;
  const [city, setCity] = useState('');
  const [active, setActive] = useState('Todas');
  const [menu, setMenu] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [lastSuccessfulSync, setLastSuccessfulSync] = useState(() => { try { return localStorage.getItem(getMarketStorageKey('last-sync')) || ''; } catch { return ''; } });
  const [appInstalled, setAppInstalled] = useState(false);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [sent, setSent] = useState(false);
  const [businesses, setBusinesses] = useState(readCachedPublicBusinesses);
  const [loadingBusinesses, setLoadingBusinesses] = useState(() => isSupabaseConfigured && readCachedPublicBusinesses().length === 0);
  const [isRefreshingBusinesses, setIsRefreshingBusinesses] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [publicRefreshMessage, setPublicRefreshMessage] = useState('');
  const [authUser, setAuthUser] = useState(null);
  const [authMode, setAuthMode] = useState('signup');
  const [authEmail, setAuthEmail] = useState('');
  const authEmailInput = useRef(null);
  const lastPublicRefreshRef = useRef(0);
  const publicRefreshInFlightRef = useRef(false);
  const [authPassword, setAuthPassword] = useState('');
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [availableCategories, setAvailableCategories] = useState([]);
  const emptyBusinessForm = { name: '', description: '', business_type: 'empresa', phone: '', city: '', state: '', postal_code: '', street: '', street_number: '', neighborhood: '', address_complement: '', location_visibility: 'neighborhood', service_cities: '', category_id: '' };
  const [businessForm, setBusinessForm] = useState(emptyBusinessForm);
  const [logoFile, setLogoFile] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const logoPreviewUrl = useMemo(() => logoFile ? URL.createObjectURL(logoFile) : '', [logoFile]);
  const galleryPreviewUrls = useMemo(() => galleryFiles.map(file => ({ name: file.name, url: URL.createObjectURL(file) })), [galleryFiles]);
  useEffect(() => {
    if (!logoPreviewUrl) return;
    return () => URL.revokeObjectURL(logoPreviewUrl);
  }, [logoPreviewUrl]);
  useEffect(() => {
    const urls = galleryPreviewUrls.map(item => item.url);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [galleryPreviewUrls]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [shareMessage, setShareMessage] = useState('');
  const [businessQr, setBusinessQr] = useState('');
  const [qrError, setQrError] = useState('');
  const [favoriteIds, setFavoriteIds] = useState(() => { try { const saved = JSON.parse(localStorage.getItem(getMarketStorageKey('favorites')) || '[]'); return Array.isArray(saved) ? saved.map(String) : []; } catch { return []; } });
  const [showFavorites, setShowFavorites] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [adminBusinesses, setAdminBusinesses] = useState([]);
  const [businessReviews, setBusinessReviews] = useState([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [adminReviews, setAdminReviews] = useState([]);
  const [adminReviewsLoading, setAdminReviewsLoading] = useState(false);
  const [adminReviewsError, setAdminReviewsError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [planSchemaReady, setPlanSchemaReady] = useState(false);
  const [adminFilter, setAdminFilter] = useState('pending');
  const [adminSearch, setAdminSearch] = useState('');
  const [adminError, setAdminError] = useState('');
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [adminCategories, setAdminCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [adminAuditLogs, setAdminAuditLogs] = useState([]);
  const [monthlyBusinessMetrics, setMonthlyBusinessMetrics] = useState([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState('');
  const [selectedReportMonth, setSelectedReportMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [auditLoading, setAuditLoading] = useState(false);
  const [ownerBusinesses, setOwnerBusinesses] = useState([]);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState('');
  const [ownerShareMessage, setOwnerShareMessage] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerSort, setOwnerSort] = useState('newest');
  const [ownerEditing, setOwnerEditing] = useState(null);
  const [marketingTone, setMarketingTone] = useState('profissional');
  const [marketingPlatform, setMarketingPlatform] = useState('instagram');
  const [marketingBusinessId, setMarketingBusinessId] = useState('');
  const [marketingOutput, setMarketingOutput] = useState('');
  const [marketingCopied, setMarketingCopied] = useState(false);
  const isAdmin = authUser?.app_metadata?.role === 'admin';

  useEffect(() => { try { localStorage.setItem(getMarketStorageKey('favorites'), JSON.stringify(favoriteIds)); } catch { /* Favoritos continuam disponíveis durante esta sessão. */ } }, [favoriteIds]);

  useEffect(() => {
    if (!isAdmin || !supabase || !navigator.onLine) return;
    let active = true;
    setMetricsLoading(true);
    setMetricsError('');
    supabase.rpc('get_admin_business_metrics', { p_month: `${selectedReportMonth}-01` })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        setMonthlyBusinessMetrics(data || []);
      })
      .catch(() => { if (active) { setMonthlyBusinessMetrics([]); setMetricsError('O relatório mensal de desempenho ainda não está disponível. Execute a migração de métricas no Supabase.'); } })
      .finally(() => { if (active) setMetricsLoading(false); });
    return () => { active = false; };
  }, [isAdmin, selectedReportMonth]);

  // Restaura a sessão do Supabase ao abrir ou atualizar o app.
  // A inscrição também mantém a interface sincronizada com login, logout e renovação de sessão.
  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.warn('Não foi possível restaurar a sessão:', error.message);
        return;
      }
      setAuthUser(data.session?.user || null);
    }).catch(error => {
      if (active) console.warn('Falha ao restaurar a sessão:', error?.message || error);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setAuthUser(session?.user || null);
    });
    return () => {
      active = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      retryPublicBusinesses();
    };
    const handleOffline = () => setIsOnline(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      if (Date.now() - lastPublicRefreshRef.current < 60000) return;
      retryPublicBusinesses();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadingBusinesses]);

  useEffect(() => {
    const handleInstallAvailable = event => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => {
      setAppInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', handleInstallAvailable);
    window.addEventListener('appinstalled', handleInstalled);
    if (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setAppInstalled(true);
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallAvailable);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  function startVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setVoiceMessage('Busca por voz indisponível neste navegador. Digite sua busca.'); return; }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR'; recognition.interimResults = false; recognition.maxAlternatives = 1;
      setVoiceMessage('Pode falar o serviço ou negócio que procura...'); setIsListening(true);
      recognition.onresult = event => { const spoken = event.results?.[0]?.[0]?.transcript || ''; if (spoken.trim()) { setQuery(spoken.trim()); setVoiceMessage('Busca preenchida. Toque em Buscar para ver os resultados.'); } };
      recognition.onerror = event => setVoiceMessage(event.error === 'not-allowed' ? 'Permita o microfone no navegador para pesquisar por voz.' : 'Não foi possível reconhecer a fala. Tente novamente ou digite.');
      recognition.onend = () => setIsListening(false); recognition.start();
    } catch { setIsListening(false); setVoiceMessage('Não foi possível iniciar o microfone.'); }
  }
  async function openNearbyMap() {
    if (!navigator.geolocation) { setLocationMessage('Localização não disponível neste navegador. Digite sua cidade para encontrar negócios próximos.'); return; }
    setNearbyMapUrl('');
    setLocationMessage('Aguardando sua permissão de localização...');
    navigator.geolocation.getCurrentPosition(async position => {
      const lat = position.coords.latitude; const lon = position.coords.longitude;
      const url = 'https://www.openstreetmap.org/?mlat=' + encodeURIComponent(lat) + '&mlon=' + encodeURIComponent(lon) + '#map=14/' + encodeURIComponent(lat) + '/' + encodeURIComponent(lon);
      setNearbyMapUrl(url);
      setLocationMessage('Localização encontrada. Identificando sua cidade para filtrar os anúncios próximos...');
      try {
        const endpoint = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=10&lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon);
        const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Falha ao consultar a região');
        const result = await response.json();
        const address = result.address || {};
        const detectedCity = address.city || address.town || address.village || address.municipality || address.county;
        if (detectedCity) {
          setCity(detectedCity);
          setLocationMessage('Cidade identificada: ' + detectedCity + '. A vitrine foi filtrada para mostrar anúncios dessa cidade. Você pode alterar o filtro manualmente.');
          document.getElementById('explorar')?.scrollIntoView({ behavior: 'smooth' });
        } else {
          setLocationMessage('Não foi possível identificar sua cidade automaticamente. Você ainda pode abrir o mapa ou digitar a cidade no campo de busca.');
        }
      } catch {
        setLocationMessage('Não foi possível identificar sua cidade agora. Você ainda pode abrir o mapa ou digitar a cidade no campo de busca.');
      }
    }, error => {
      setNearbyMapUrl('');
      setLocationMessage(error.code === 1 ? 'Permissão negada. Digite sua cidade para encontrar negócios próximos.' : 'Não foi possível obter a localização. Confira as permissões do navegador ou digite sua cidade.');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }
  async function installApp() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

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

  function generateMarketingCopy() {
    const selectedMarketingBusiness = ownerBusinesses.find(item => String(item.id) === String(marketingBusinessId));
    const source = ownerEditing || selectedMarketingBusiness || ownerBusinesses[0] || businessForm;
    const name = String(source.name || '').trim() || 'Meu negócio';
    const description = String(source.description || '').trim();
    const cityName = [source.city, source.state].filter(Boolean).join(' - ');
    const service = description || 'Conheça nossos produtos e serviços. Entre em contato para saber mais.';
    const location = cityName ? ` Atendemos em ${cityName}.` : '';
    const opening = marketingTone === 'proximo'
      ? 'Olá! Queremos apresentar nosso trabalho para você.'
      : marketingTone === 'direto'
        ? 'Está procurando produtos ou serviços? Conte com a gente.'
        : 'Qualidade, compromisso e atendimento para você.';
    const platformText = marketingPlatform === 'whatsapp'
      ? `${opening}\n\n*${name}*\n${service}${location}\n\nChame nesta conversa para pedir informações ou solicitar um orçamento.`
      : marketingPlatform === 'facebook'
        ? `${opening}\n\n*${name}* — ${service}${location}\n\nEnvie uma mensagem e saiba mais!\n\n#ConectaBrasil #NegócioLocal #Empreendedorismo`
        : marketingPlatform === 'tiktok'
          ? `${opening}\n\n✨ ${name}\n${service}${location}\n\nSiga o perfil e compartilhe com quem precisa conhecer nosso trabalho!\n\n#ConectaBrasil #NegócioLocal #TikTokBrasil`
          : `${opening}\n\n*${name}*\n${service}${location}\n\nSalve este perfil e entre em contato para saber mais!\n\n#ConectaBrasil #NegócioLocal #Empreendedorismo #Brasil`;
    const publicProfileLink = source.id && source.status === 'approved'
      ? (() => {
          const profileUrl = new URL(window.location.href);
          profileUrl.searchParams.set('negocio', source.id);
          return profileUrl.toString();
        })()
      : '';
    setMarketingOutput(`${platformText}${publicProfileLink ? `\n\nVeja o perfil no Conecta Brasil:\n${publicProfileLink}` : ''}`);
    setMarketingCopied(false);
  }

  async function copyMarketingCopy() {
    if (!marketingOutput) return;
    try {
      await navigator.clipboard.writeText(marketingOutput);
      setMarketingCopied(true);
    } catch {
      setMarketingCopied(false);
      setFormError('Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.');
    }
  }

  function changeListingPage(direction) {
    setListingPage(page => {
      const nextPage = Math.min(listingPageCount, Math.max(1, page + direction));
      return nextPage;
    });
    document.getElementById('explorar')?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  function toggleFavorite(item) {
    const key = String(item.id || item.name);
    setFavoriteIds(current => current.includes(key) ? current.filter(id => id !== key) : [...current, key]);
  }

  useEffect(() => {
    if (selectedBusiness?.id) trackBusinessMetric(selectedBusiness, 'views_count');
  }, [selectedBusiness?.id]);

  useEffect(() => {
    let active = true;
    if (!selectedBusiness?.id) {
      setBusinessQr('');
      setQrError('');
      return () => { active = false; };
    }
    const publicUrl = new URL(window.location.href);
    publicUrl.searchParams.set('negocio', selectedBusiness.id);
    QRCode.toDataURL(publicUrl.toString(), { width: 220, margin: 2, errorCorrectionLevel: 'M' })
      .then(dataUrl => { if (active) { setBusinessQr(dataUrl); setQrError(''); } })
      .catch(() => { if (active) { setBusinessQr(''); setQrError('Não foi possível gerar o QR Code neste momento.'); } });
    return () => { active = false; };
  }, [selectedBusiness?.id]);

  async function trackBusinessMetric(item, metric) {
    if (!isSupabaseConfigured || !supabase || !item?.id || item.isPaginationTest) return;
    try { await supabase.rpc('increment_business_metric', { p_business_id: item.id, p_metric: metric }); } catch { /* Métricas não podem bloquear a navegação ou o contato. */ }
  }

  function openBusinessDetails(item) {
    setSelectedBusiness(item);
    setShareMessage('');
    const url = new URL(window.location.href);
    url.searchParams.set('negocio', item.id);
    window.history.pushState({ conectaBusinessModal: true }, '', url);
  }

  async function loadBusinessReviews(businessId) {
    if (!supabase || !businessId) { setBusinessReviews([]); return; }
    const { data, error } = await supabase.from('business_reviews').select('id,rating,comment,created_at').eq('business_id', businessId).eq('status', 'approved').order('created_at', { ascending: false });
    if (error) { setBusinessReviews([]); setReviewError('As avaliações ainda não puderam ser carregadas.'); return; }
    setBusinessReviews(data || []);
  }
  useEffect(() => {
    if (!selectedBusiness?.id) { setBusinessReviews([]); setReviewError(''); return; }
    setReviewError(''); loadBusinessReviews(selectedBusiness.id);
  }, [selectedBusiness?.id]);
  async function submitBusinessReview(event) {
    event.preventDefault();
    if (!authUser) { setReviewError('Entre na sua conta para enviar uma avaliação.'); return; }
    if (!navigator.onLine) { setReviewError('Você precisa estar conectado para enviar uma avaliação.'); return; }
    if (reviewComment.trim().length < 5) { setReviewError('Escreva pelo menos 5 caracteres.'); return; }
    setReviewBusy(true); setReviewError(''); setReviewMessage('');
    const { error } = await supabase.from('business_reviews').insert({ business_id: selectedBusiness.id, user_id: authUser.id, rating: Number(reviewRating), comment: reviewComment.trim(), status: 'pending' });
    if (error) setReviewError(error.code === '23505' ? 'Você já enviou uma avaliação para este negócio.' : 'Não foi possível enviar. Confira sua conexão e tente novamente.');
    else { setReviewComment(''); setReviewMessage('Avaliação enviada! Ela ficará visível após análise da equipe.'); }
    setReviewBusy(false);
  }
  async function loadAdminReviews() {
    if (!isAdmin || !navigator.onLine) return;
    setAdminReviewsLoading(true); setAdminReviewsError('');
    const { data, error } = await supabase.from('business_reviews').select('id,business_id,user_id,rating,comment,status,created_at,businesses(name)').order('created_at', { ascending: false }).limit(100);
    if (error) { setAdminReviewsError('Não foi possível carregar avaliações. Confira se business_reviews.sql foi executado.'); setAdminReviews([]); }
    else setAdminReviews(data || []);
    setAdminReviewsLoading(false);
  }
  async function moderateReview(review, status) {
    if (formBusy || !navigator.onLine) { setAdminReviewsError('Conecte-se à internet antes de moderar.'); return; }
    setFormBusy(true); setAdminReviewsError('');
    const { error } = await supabase.from('business_reviews').update({ status }).eq('id', review.id);
    if (error) setAdminReviewsError('Não foi possível atualizar esta avaliação.');
    else setAdminReviews(items => items.map(item => item.id === review.id ? { ...item, status } : item));
    setFormBusy(false);
  }
  function closeBusinessDetails() {
    setSelectedBusiness(null);
    setShareMessage('');
    const url = new URL(window.location.href);
    url.searchParams.delete('negocio');
    // Volta à entrada anterior quando o modal foi aberto dentro do app.
    // Em links recebidos diretamente, apenas limpa o parâmetro sem sair da página.
    if (window.history.state?.conectaBusinessModal) {
      window.history.back();
    } else {
      window.history.replaceState({}, '', url);
    }
  }

  async function shareBusiness(item) {
    const url = new URL(window.location.href);
    url.searchParams.set('negocio', item.id);
    const details = [
      item.name,
      item.category ? `Categoria: ${item.category}` : '',
      item.city ? `Localização: ${item.city}` : '',
      item.desc ? String(item.desc).trim() : '',
      'Encontre este negócio no Conecta Brasil:',
      url.toString(),
    ].filter(Boolean).join('\n');
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${item.name} | Conecta Brasil`,
          text: details,
          url: url.toString(),
        });
        setShareMessage('Compartilhamento preparado com os dados do negócio.');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(details);
        setShareMessage('Texto e link copiados! Agora é só compartilhar.');
      } else {
        setShareMessage('Seu navegador não permite compartilhar automaticamente. Copie o endereço exibido na barra do navegador.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') setShareMessage('Não foi possível compartilhar automaticamente. Tente copiar o link do perfil.');
    }
  }

  async function loadAdminAuditLogs() {
    if (!isAdmin || auditLoading) return;
    setAuditLoading(true);
    try {
      const { data, error } = await supabase.from('admin_audit_logs')
        .select('id,action,entity_type,entity_name,details,actor_email,created_at')
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      setAdminAuditLogs(data || []);
    } catch {
      setAdminError('Não foi possível carregar o histórico. Verifique sua conexão e as permissões de auditoria no Supabase.');
    } finally {
      setAuditLoading(false);
    }
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
    if (!isAdmin || adminLoading) return;
    if (!navigator.onLine) { setAdminError('Sem conexão com a internet. Reconecte-se para atualizar a administração.'); return; }
    setAdminLoading(true);
    setAdminError('');
    try {
      let result = await supabase.from('businesses')
        .select('id,name,description,business_type,phone,city,state,postal_code,street,street_number,neighborhood,address_complement,location_visibility,service_cities,status,featured,featured_expires_at,plan_type,plan_started_at,plan_expires_at,verified,views_count,whatsapp_clicks,created_at,logo_url,gallery_urls,business_categories(categories(name))')
        .eq('country', market.legacyCountry).order('created_at', { ascending: false });
      if (result.error && /postal_code|street_number|address_complement|location_visibility|service_cities|column/i.test(result.error.message || '')) {
        result = await supabase.from('businesses')
          .select('id,name,description,business_type,phone,city,state,status,featured,featured_expires_at,plan_type,plan_started_at,plan_expires_at,verified,views_count,whatsapp_clicks,created_at,logo_url,gallery_urls,business_categories(categories(name))')
          .eq('country', market.legacyCountry).order('created_at', { ascending: false });
      }
      if (result.error && /plan_type|plan_started_at|plan_expires_at|featured_expires_at|column/i.test(result.error.message || '')) {
          setPlanSchemaReady(false);
          result = await supabase.from('businesses')
            .select('id,name,description,business_type,phone,city,state,status,featured,verified,views_count,whatsapp_clicks,created_at,logo_url,gallery_urls,business_categories(categories(name))')
            .eq('country', market.legacyCountry).order('created_at', { ascending: false });
        }
        if (result.error && /verified|views_count|whatsapp_clicks|column/i.test(result.error.message || '')) {
        result = await supabase.from('businesses')
          .select('id,name,description,business_type,phone,city,state,status,featured,created_at,logo_url,gallery_urls,business_categories(categories(name))')
          .eq('country', market.legacyCountry).order('created_at', { ascending: false });
      }
      if (result.error) throw result.error;
      setPlanSchemaReady(Boolean(result.data?.length === 0 || Object.prototype.hasOwnProperty.call(result.data?.[0] || {}, 'plan_type')));
      // O bucket business-images é privado: o painel administrativo também
      // precisa receber URLs assinadas para exibir logos e galerias.
      const businessesWithImages = await Promise.all((result.data || []).map(async item => ({
        ...item,
        logo_url: item.logo_url ? await createBusinessImageUrl(item.logo_url) : '',
        gallery_urls: await Promise.all((item.gallery_urls || []).map(createBusinessImageUrl)),
      })));
      setAdminBusinesses(businessesWithImages);
      const cats = await supabase.from('categories').select('id,name,active').order('name');
      if (cats.error) throw cats.error;
      setAdminCategories(cats.data || []);
      await loadAdminAuditLogs();
      await loadAdminReviews();
    } catch {
      setAdminError('Não foi possível atualizar o painel administrativo. Verifique sua conexão e tente novamente.');
    } finally {
      setAdminLoading(false);
    }
  }

  async function saveBusinessEdit(event) {
    event.preventDefault();
    if (!editingBusiness || formBusy) return;
    if (!navigator.onLine) { setAdminError('Você está sem internet. Reconecte-se antes de salvar as alterações.'); return; }
    const cleanName = String(editingBusiness.name || '').trim();
    const cleanCity = String(editingBusiness.city || '').trim();
    const cleanState = String(editingBusiness.state || '').trim().toUpperCase();
    const phoneDigits = String(editingBusiness.phone || '').replace(/\D/g, '');
    if (!cleanName || !cleanCity || !/^[A-Z]{2}$/.test(cleanState)) {
      setAdminError('Preencha o nome, a cidade e uma UF válida com duas letras.');
      return;
    }
    if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
      setAdminError('Confira o telefone/WhatsApp: informe DDD e número.');
      return;
    }
    if ((editingBusiness.location_visibility || 'neighborhood') === 'exact' &&
      (!/^[0-9]{5}-?[0-9]{3}$/.test(String(editingBusiness.postal_code || '').trim()) ||
       !String(editingBusiness.street || '').trim() ||
       !String(editingBusiness.street_number || '').trim() ||
       !String(editingBusiness.neighborhood || '').trim())) {
      setAdminError('Para mostrar o endereço completo, informe CEP, rua/avenida, número e bairro.');
      return;
    }
    setFormBusy(true);
    setAdminError('');
    const payload = {
      name: cleanName,
      description: String(editingBusiness.description || '').trim(),
      phone: String(editingBusiness.phone || '').trim(),
      city: cleanCity,
      state: cleanState,
      postal_code: String(editingBusiness.postal_code || '').trim(),
      street: String(editingBusiness.street || '').trim(),
      street_number: String(editingBusiness.street_number || '').trim(),
      neighborhood: String(editingBusiness.neighborhood || '').trim(),
      address_complement: String(editingBusiness.address_complement || '').trim(),
      location_visibility: editingBusiness.location_visibility || 'neighborhood',
      service_cities: String(editingBusiness.service_cities || '').trim()
    };
    try {
      const { error } = await supabase.from('businesses').update(payload).eq('id', editingBusiness.id);
      if (error) {
        setAdminError('Não foi possível salvar a edição: ' + error.message);
        return;
      }
      setAdminBusinesses(rows => rows.map(row => row.id === editingBusiness.id ? { ...row, ...payload } : row));
      try { await recordAdminAction('editado', 'anúncio', editingBusiness.id, payload.name, payload); }
      catch { setAdminError('A edição foi salva, mas o histórico administrativo não pôde ser atualizado.'); }
      if (String(selectedBusiness?.id) === String(editingBusiness.id)) {
        setSelectedBusiness(current => current ? { ...current, ...payload } : current);
      }
      setEditingBusiness(null);
      try {
        setBusinesses(await fetchPublicBusinesses(market));
        setLoadError('');
      } catch {
        setLoadError('A edição foi salva, mas a vitrine não pôde ser atualizada agora. Use “Atualizar anúncios” para sincronizar.');
      }
    } catch (error) {
      setAdminError('Falha de conexão ao salvar a edição. Tente novamente. ' + (error?.message || ''));
    } finally {
      setFormBusy(false);
    }
  }

  async function addAdminCategory(event) {
    event.preventDefault();
    if (formBusy) return;
    const name = String(newCategory || '').trim();
    if (!name) return;
    const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'categoria-' + Date.now();
    setFormBusy(true);
    setAdminError('');
    try {
      const { data, error } = await supabase.from('categories')
        .insert({ name, slug, active: true }).select('id,name,active').single();
      if (error) {
        const message = error.code === '23505'
          ? 'Já existe uma categoria com esse nome ou endereço. Escolha outro nome.'
          : error.message;
        setAdminError('Não foi possível criar a categoria: ' + message);
        return;
      }
      setAdminCategories(rows => [...rows, data].sort((a,b)=>a.name.localeCompare(b.name)));
      setNewCategory('');
      setAvailableCategories(rows => [...rows, {id:data.id,name:data.name}].sort((a,b)=>a.name.localeCompare(b.name)));
      await recordAdminAction('criada', 'categoria', data.id, data.name);
    } catch (error) {
      setAdminError('Falha de conexão ao criar categoria. ' + (error?.message || 'Tente novamente.'));
    } finally {
      setFormBusy(false);
    }
  }

  async function toggleCategory(category) {
    if (formBusy) return;
    setFormBusy(true);
    setAdminError('');
    try {
      const { error } = await supabase.from('categories')
        .update({ active: !category.active }).eq('id', category.id);
      if (error) {
        setAdminError('Não foi possível alterar a categoria: ' + error.message);
        return;
      }
      setAdminCategories(rows => rows.map(row => row.id === category.id ? {...row,active:!category.active} : row));
      setAvailableCategories(rows => category.active
        ? rows.filter(row => row.id !== category.id)
        : [...rows,{id:category.id,name:category.name}]);
      await recordAdminAction(category.active ? 'desativada' : 'ativada', 'categoria', category.id, category.name);
    } catch (error) {
      setAdminError('Falha de conexão ao alterar categoria. ' + (error?.message || 'Tente novamente.'));
    } finally {
      setFormBusy(false);
    }
  }

  async function toggleVerified(item) {
    if (formBusy) return;
    setFormBusy(true);
    setAdminError('');
    try {
      const nextVerified = !item.verified;
      const { error } = await supabase.from('businesses').update({ verified: nextVerified }).eq('id', item.id);
      if (error) throw error;
      setAdminBusinesses(items => items.map(row => row.id === item.id ? { ...row, verified: nextVerified } : row));
      await recordAdminAction(nextVerified ? 'selo verificado concedido' : 'selo verificado removido', 'anúncio', item.id, item.name);
      try {
        setBusinesses(await fetchPublicBusinesses(market));
        setLoadError('');
      } catch {
        setLoadError('O selo foi salvo, mas a vitrine não pôde ser atualizada agora. Use “Atualizar anúncios” para sincronizar.');
      }
    } catch (error) {
      setAdminError('Não foi possível alterar o selo de verificação: ' + (error?.message || 'verifique a conexão e a migração de inovações.'));
    } finally {
      setFormBusy(false);
    }
  }

  async function setBusinessPlan(item, planType) {
    if (formBusy) return;
    if (!navigator.onLine) { setAdminError('Sem conexão. Reconecte-se antes de alterar ou renovar planos.'); return; }
    if (planType !== 'gratuito' && item.status !== 'approved') {
      setAdminError('Aprove o cadastro antes de ativar um plano pago.');
      return;
    }
    const isRenewal = planType !== 'gratuito' && (item.plan_type || (item.featured ? 'destaque' : 'gratuito')) === planType;
    const confirmed = window.confirm(planType === 'gratuito'
      ? 'Remover o plano e o destaque de ' + item.name + '?'
      : (isRenewal ? 'Renovar o plano ' : 'Ativar o plano ') + (planType === 'destaque' ? 'Destaque' : 'Parceiro') + ' por mais 30 dias para ' + item.name + '? Confirme somente após verificar a contratação.');
    if (!confirmed) return;
    setFormBusy(true);
    setAdminError('');
    const startedAt = new Date();
    const expiresAt = planType === 'gratuito' ? null : new Date(startedAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const payload = {
      plan_type: planType,
      plan_started_at: planType === 'gratuito' ? null : startedAt.toISOString(),
      plan_expires_at: expiresAt,
      featured: planType !== 'gratuito',
      featured_expires_at: expiresAt
    };
    try {
      const { error } = await supabase.from('businesses').update(payload).eq('id', item.id);
      if (error) throw error;
      setAdminBusinesses(rows => rows.map(row => row.id === item.id ? { ...row, ...payload } : row));
      await recordAdminAction(planType === 'gratuito' ? 'plano removido' : (isRenewal ? 'plano renovado por 30 dias' : 'plano ativado por 30 dias'), 'plano', item.id, item.name, { plan_type: planType, expires_at: expiresAt, renewal: isRenewal });
      try {
        setBusinesses(await fetchPublicBusinesses(market));
        setLoadError('');
      } catch {
        setLoadError('O plano foi salvo, mas a vitrine ainda não foi atualizada. Atualize os anúncios.');
      }
    } catch (error) {
      setAdminError('Não foi possível salvar o plano. Confira se executou supabase/plans.sql. ' + (error?.message || ''));
    } finally {
      setFormBusy(false);
    }
  }

  async function toggleFeatured(item) {
    if (formBusy) return;
    if (!navigator.onLine) { setAdminError('Sem conexão. Reconecte-se antes de alterar o destaque.'); return; }
    setFormBusy(true);
    setAdminError('');
    try {
      const { error } = await supabase.from('businesses').update({ featured: !item.featured }).eq('id', item.id);
      if (error) {
        setAdminError('Não foi possível alterar o destaque: ' + error.message);
        return;
      }
      setAdminBusinesses(items => items.map(row => row.id === item.id ? { ...row, featured: !item.featured } : row));
      await recordAdminAction(item.featured ? 'destaque removido' : 'destacado', 'anúncio', item.id, item.name);
      try {
        setBusinesses(await fetchPublicBusinesses(market));
        setLoadError('');
      } catch {
        setLoadError('O destaque foi salvo, mas a vitrine não pôde ser atualizada agora. Use “Atualizar anúncios” para sincronizar.');
      }
    } catch (error) {
      setAdminError('Falha de conexão ao alterar destaque. ' + (error?.message || 'Tente novamente.'));
    } finally {
      setFormBusy(false);
    }
  }

  async function deleteBusiness(item) {
    if (!navigator.onLine) { setAdminError('Sem conexão. Reconecte-se antes de excluir um anúncio.'); return; }
    const confirmed = window.confirm("Excluir definitivamente o anúncio \"" + item.name + "\"? Esta ação não pode ser desfeita.");
    if (!confirmed || formBusy) return;
    setFormBusy(true);
    setAdminError('');
    try {
      const { error } = await supabase.from('businesses').delete().eq('id', item.id);
      if (error) {
        setAdminError('Não foi possível excluir o anúncio: ' + error.message);
        return;
      }
      setAdminBusinesses(items => items.filter(row => row.id !== item.id));
      try { await recordAdminAction('excluído', 'anúncio', item.id, item.name, { status_anterior: item.status }); }
      catch { setAdminError('O anúncio foi excluído, mas o histórico administrativo não pôde ser atualizado.'); }
      if (editingBusiness?.id === item.id) setEditingBusiness(null);
      if (selectedBusiness?.id === item.id) setSelectedBusiness(null);
      try {
        setBusinesses(await fetchPublicBusinesses(market));
        setLoadError('');
      } catch {
        setLoadError('O anúncio foi excluído, mas a vitrine não pôde ser atualizada agora. Use “Atualizar anúncios” para sincronizar.');
      }
    } catch (error) {
      setAdminError('Falha de conexão ao excluir o anúncio. ' + (error?.message || ''));
    } finally {
      setFormBusy(false);
    }
  }

  async function moderateBusiness(id, status) {
    if (formBusy) return;
    if (!navigator.onLine) { setAdminError('Sem conexão. Reconecte-se antes de moderar este cadastro.'); return; }
    setFormBusy(true);
    setAdminError('');
    try {
      const { error } = await supabase.from('businesses').update({ status }).eq('id', id);
      if (error) {
        setAdminError('Não foi possível atualizar este cadastro: ' + error.message);
        return;
      }
      const changed = adminBusinesses.find(item => item.id === id);
      setAdminBusinesses(items => items.map(item => item.id === id ? { ...item, status } : item));
      try {
        await recordAdminAction(status === 'approved' ? 'aprovado' : status === 'rejected' ? 'rejeitado' : status === 'suspended' ? 'suspenso' : 'retornado para análise', 'anúncio', id, changed?.name || 'Anúncio', { status_novo: status, status_anterior: changed?.status || null });
      } catch {
        setAdminError('A moderação foi salva, mas o histórico administrativo não pôde ser atualizado.');
      }
      if (String(selectedBusiness?.id) === String(id) && status !== 'approved') closeBusinessDetails();
      try {
        setBusinesses(await fetchPublicBusinesses(market));
        setLoadError('');
      } catch {
        setLoadError('A moderação foi salva, mas a vitrine não pôde ser atualizada agora. Use “Atualizar anúncios” para sincronizar.');
      }
    } catch (error) {
      setAdminError('Falha de conexão ao atualizar o cadastro. Tente novamente. ' + (error?.message || ''));
    } finally {
      setFormBusy(false);
    }
  }

  async function loadOwnerBusinesses() {
    if (!authUser || isAdmin || ownerLoading) return;
    if (!navigator.onLine) { setOwnerError('Sem conexão com a internet. Seus anúncios salvos continuam disponíveis quando carregados anteriormente.'); return; }
    setOwnerLoading(true);
    setOwnerError('');
    try {
      let result = await supabase.from('businesses')
        .select('id,name,description,business_type,phone,city,state,postal_code,street,street_number,neighborhood,address_complement,location_visibility,service_cities,status,views_count,whatsapp_clicks,created_at,updated_at,business_categories(categories(name))')
        .eq('owner_id', authUser.id).eq('country', market.legacyCountry).order('created_at', { ascending: false });
      if (result.error && /postal_code|street_number|address_complement|location_visibility|service_cities|column/i.test(result.error.message || '')) {
        result = await supabase.from('businesses')
          .select('id,name,description,business_type,phone,city,state,status,views_count,whatsapp_clicks,created_at,updated_at,business_categories(categories(name))')
          .eq('owner_id', authUser.id).eq('country', market.legacyCountry).order('created_at', { ascending: false });
      }
      if (result.error && /views_count|whatsapp_clicks|column/i.test(result.error.message || '')) {
        result = await supabase.from('businesses')
          .select('id,name,description,business_type,phone,city,state,status,created_at,updated_at,business_categories(categories(name))')
          .eq('owner_id', authUser.id).eq('country', market.legacyCountry).order('created_at', { ascending: false });
      }
      if (result.error) throw result.error;
      setOwnerBusinesses(result.data || []);
    } catch {
      setOwnerError('Não foi possível atualizar seus anúncios. Verifique sua conexão e tente novamente.');
    } finally {
      setOwnerLoading(false);
    }
  }

  async function copyOwnerBusinessLink(item) {
    const url = new URL(window.location.href);
    url.searchParams.set('negocio', item.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      setOwnerShareMessage('Link público de ' + item.name + ' copiado!');
    } catch {
      setOwnerShareMessage('Não foi possível copiar automaticamente. Abra o anúncio na vitrine para compartilhar.');
    }
  }

  async function saveOwnerBusiness(event) {
    event.preventDefault();
    if (!ownerEditing || formBusy) return;
    if (!navigator.onLine) { setOwnerError('Você está sem internet. Reconecte-se antes de salvar; suas alterações continuam nesta tela.'); return; }
    setFormBusy(true);
    setOwnerError('');
    try {
      const originalStatus = ownerEditing.status;
      const cleanName = String(ownerEditing.name || '').trim();
      const cleanCity = String(ownerEditing.city || '').trim();
      const cleanState = String(ownerEditing.state || '').trim().toUpperCase();
      const phoneDigits = String(ownerEditing.phone || '').replace(/\D/g, '');
      if (!cleanName || !cleanCity || !/^[A-Z]{2}$/.test(cleanState)) {
        setOwnerError('Preencha o nome, a cidade e uma UF válida com duas letras.');
        return;
      }
      if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
        setOwnerError('Confira o telefone/WhatsApp: informe DDD e número.');
        return;
      }
      const visibility = ownerEditing.location_visibility || 'neighborhood';
      const postalCode = String(ownerEditing.postal_code || '').trim();
      if (visibility === 'exact' && (!/^[0-9]{5}-?[0-9]{3}$/.test(postalCode) || !String(ownerEditing.street || '').trim() || !String(ownerEditing.street_number || '').trim() || !String(ownerEditing.neighborhood || '').trim())) {
        setOwnerError('Para mostrar o endereço completo, informe CEP, rua/avenida, número e bairro.');
        return;
      }
      const payload = {
        name: cleanName, description: (ownerEditing.description || '').trim(),
        business_type: ownerEditing.business_type, phone: (ownerEditing.phone || '').trim(),
        city: cleanCity, state: cleanState,
        postal_code: postalCode, street: String(ownerEditing.street || '').trim(),
        street_number: String(ownerEditing.street_number || '').trim(),
        neighborhood: String(ownerEditing.neighborhood || '').trim(),
        address_complement: String(ownerEditing.address_complement || '').trim(),
        location_visibility: visibility,
        service_cities: String(ownerEditing.service_cities || '').trim(),
        ...(originalStatus === 'approved' ? { status: 'pending', featured: false } : {})
      };
      const { data, error } = await supabase.from('businesses').update(payload)
        .eq('id', ownerEditing.id).eq('owner_id', authUser.id).eq('status', originalStatus)
        .select('id').maybeSingle();
      if (error || !data) {
        setOwnerError('Não foi possível salvar. Confira sua conexão e tente novamente.' + (error?.message ? ' ' + error.message : ''));
        return;
      }
      setOwnerBusinesses(rows => rows.map(row => row.id === ownerEditing.id ? { ...row, ...payload, updated_at: new Date().toISOString() } : row));
      if (originalStatus === 'approved') {
        setBusinesses(rows => {
          const next = rows.filter(row => String(row.id) !== String(ownerEditing.id));
          try { localStorage.setItem(getMarketStorageKey('public-businesses'), JSON.stringify(next.map(({ icon, ...item }) => item))); } catch { /* A vitrine continua disponível durante esta sessão. */ }
          return next;
        });
        if (String(selectedBusiness?.id) === String(ownerEditing.id)) setSelectedBusiness(null);
      }
      setOwnerEditing(null);
      setFormMessage(originalStatus === 'approved'
        ? 'Alterações enviadas! Seu anúncio ficará temporariamente em análise até a nova aprovação.'
        : 'Alterações salvas. Seu anúncio continua aguardando aprovação.');
    } catch (error) {
      setOwnerError('Ocorreu uma falha ao salvar. Verifique sua conexão e tente novamente.' + (error?.message ? ' ' + error.message : ''));
    } finally {
      setFormBusy(false);
    }
  }

  useEffect(() => {
    if (authUser && !isAdmin) loadOwnerBusinesses();
    else setOwnerBusinesses([]);
  }, [authUser?.id, isAdmin]);

  function openPasswordRecovery() {
    setForgotPasswordMode(true);
    setFormError('');
    setFormMessage('Digite seu e-mail para receber o link de recuperação.');
  }

  async function requestPasswordRecovery(event) {
    event.preventDefault();
    if (!navigator.onLine) { setFormError('Sem conexão com a internet. Reconecte-se para solicitar a recuperação de senha.'); return; }
    const email = String(authEmailInput.current?.value || authEmail || '').trim();
    if (!email) { setFormError('Informe seu e-mail para receber o link de recuperação.'); authEmailInput.current?.focus(); return; }
    setAuthEmail(email);
    setFormBusy(true); setFormError(''); setFormMessage('');
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
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
    if (!navigator.onLine) { setFormError('Sem conexão com a internet. Reconecte-se para entrar ou criar sua conta.'); return; }
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

  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  function handleLogoSelection(event) {
    const file = event.target.files?.[0] || null;
    setFormError('');
    if (file && !allowedImageTypes.includes(file.type)) {
      setLogoFile(null);
      event.target.value = '';
      setFormError('Formato de logo não permitido. Use JPG, PNG, WEBP ou GIF.');
      return;
    }
    if (file && file.size === 0) {
      setLogoFile(null);
      event.target.value = '';
      setFormError('O arquivo da logo está vazio. Escolha outra imagem.');
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      setLogoFile(null);
      event.target.value = '';
      setFormError('A logo ultrapassa o limite de 5 MB. Escolha uma imagem menor.');
      return;
    }
    setLogoFile(file);
  }

  function handleGallerySelection(event) {
    const files = Array.from(event.target.files || []);
    setFormError('');
    if (files.length > 5) {
      setGalleryFiles([]);
      event.target.value = '';
      setFormError('Você selecionou mais de 5 fotos. Escolha no máximo 5 imagens.');
      return;
    }
    const invalidType = files.find(file => !allowedImageTypes.includes(file.type));
    if (invalidType) {
      setGalleryFiles([]);
      event.target.value = '';
      setFormError(`O arquivo "${invalidType.name}" não é JPG, PNG, WEBP ou GIF.`);
      return;
    }
    const emptyFile = files.find(file => file.size === 0);
    if (emptyFile) {
      setGalleryFiles([]);
      event.target.value = '';
      setFormError(`O arquivo \"${emptyFile.name}\" está vazio. Escolha outra imagem.`);
      return;
    }
    const oversized = files.find(file => file.size > 5 * 1024 * 1024);
    if (oversized) {
      setGalleryFiles([]);
      event.target.value = '';
      setFormError(`A foto "${oversized.name}" ultrapassa o limite de 5 MB.`);
      return;
    }
    setGalleryFiles(files);
  }

  async function handleBusinessSubmit(event) {
    event.preventDefault();
    if (formBusy) return;
    setFormError(''); setFormMessage('');
    if (!navigator.onLine) { setFormError('Você está sem internet. Reconecte-se antes de enviar o cadastro; seus dados preenchidos continuam nesta tela.'); return; }
    if (!supabase || !authUser) { setFormError('Entre na sua conta para enviar o cadastro.'); return; }
    const name = businessForm.name.trim();
    const city = businessForm.city.trim();
    const state = businessForm.state.trim().toUpperCase();
    const phoneDigits = businessForm.phone.replace(/\D/g, '');
    const selectedImages = [logoFile, ...galleryFiles].filter(Boolean);
    if (!name || !city || !/^[A-Z]{2}$/.test(state)) {
      setFormError('Informe o nome do negócio, a cidade e uma UF válida com duas letras.');
      return;
    }
    if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
      setFormError('Confira o telefone/WhatsApp. Informe o DDD e o número completo.');
      return;
    }
    if (galleryFiles.length > 5) {
      setFormError('Selecione no máximo 5 fotos para a galeria.');
      return;
    }
    const invalidImage = selectedImages.find(file => !allowedImageTypes.includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024);
    if (invalidImage) {
      setFormError(!allowedImageTypes.includes(invalidImage.type)
        ? 'Use somente imagens JPG, PNG, WEBP ou GIF.'
        : `A imagem ${invalidImage.name} ultrapassa o limite de 5 MB.`);
      return;
    }
    setFormBusy(true);
    let createdBusinessId = null;
    const uploadedPaths = [];
    try {
      const visibility = businessForm.location_visibility || 'neighborhood';
      const postalCode = String(businessForm.postal_code || '').trim();
      if (visibility === 'exact' && (!/^[0-9]{5}-?[0-9]{3}$/.test(postalCode) || !businessForm.street.trim() || !businessForm.street_number.trim() || !businessForm.neighborhood.trim())) {
        setFormError('Para mostrar o endereço completo, informe CEP, rua/avenida, número e bairro.');
        return;
      }
      const slugBase = businessForm.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const slug = slugBase + '-' + crypto.randomUUID().slice(0, 8);
      const { data, error } = await supabase.from('businesses').insert({
        owner_id: authUser.id, name, slug, country: market.legacyCountry,
        description: businessForm.description.trim(), business_type: businessForm.business_type,
        phone: businessForm.phone.trim(), city,
        state, postal_code: postalCode, street: businessForm.street.trim(),
        street_number: businessForm.street_number.trim(), neighborhood: businessForm.neighborhood.trim(),
        address_complement: businessForm.address_complement.trim(),
        location_visibility: visibility, service_cities: businessForm.service_cities.trim(),
        status: 'pending', featured: false
      }).select('id').single();
      if (error) throw error;
      createdBusinessId = data.id;
      const uploadedPhotos = [];
      const uploadImage = async (file, label) => {
        if (!file) return null;
        if (!allowedImageTypes.includes(file.type)) throw new Error('Use somente imagens JPG, PNG, WEBP ou GIF.');
        if (file.size > 5 * 1024 * 1024) throw new Error(`A imagem ${file.name} ultrapassa o limite de 5 MB.`);
        const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
        const path = `${authUser.id}/${createdBusinessId}/${label}-${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('business-images').upload(path, file, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        return supabase.storage.from('business-images').getPublicUrl(path).data.publicUrl;
      };
      const logoUrl = await uploadImage(logoFile, 'logo');
      for (let i = 0; i < galleryFiles.length; i++) uploadedPhotos.push(await uploadImage(galleryFiles[i], `foto-${i + 1}`));
      if (logoUrl || uploadedPhotos.length) {
        const { error: imageError } = await supabase.from('businesses').update({ logo_url: logoUrl, gallery_urls: uploadedPhotos }).eq('id', createdBusinessId);
        if (imageError) throw imageError;
      }
      if (businessForm.category_id) {
        const { error: categoryError } = await supabase.from('business_categories').insert({
          business_id: createdBusinessId, category_id: businessForm.category_id
        });
        if (categoryError) throw categoryError;
      }
      setFormMessage('Cadastro enviado para análise! Seu negócio aparecerá na vitrine depois da aprovação.');
      await loadOwnerBusinesses();
      setBusinessForm(emptyBusinessForm);
      setLogoFile(null); setGalleryFiles([]);
    } catch (error) {
      let cleanupFailed = false;
      if (uploadedPaths.length) {
        const { error: storageCleanupError } = await supabase.storage.from('business-images').remove(uploadedPaths);
        if (storageCleanupError) cleanupFailed = true;
      }
      if (createdBusinessId) {
        const { error: rowCleanupError } = await supabase.from('businesses').delete()
          .eq('id', createdBusinessId).eq('owner_id', authUser.id);
        if (rowCleanupError) cleanupFailed = true;
      }
      setFormError((error.message || 'Não foi possível enviar o cadastro.')
        + (cleanupFailed ? ' Alguns dados temporários não puderam ser removidos automaticamente; entre em contato com o suporte.' : ''));
    } finally { setFormBusy(false); }
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let alive = true;
    fetchPublicBusinesses(market)
      .then(rows => { if (alive) { setBusinesses(rows); const syncedAt = new Date().toISOString(); setLastSuccessfulSync(syncedAt); try { localStorage.setItem(getMarketStorageKey('last-sync'), syncedAt); } catch { /* A lista segue disponível na sessão. */ } } })
      .catch(() => { if (alive) setLoadError('Não foi possível carregar os cadastros agora.'); })
      .finally(() => { if (alive) setLoadingBusinesses(false); });
    return () => { alive = false; };
  }, []);

  async function retryPublicBusinesses() {
    if (!isSupabaseConfigured || !supabase || loadingBusinesses || publicRefreshInFlightRef.current) return;
    publicRefreshInFlightRef.current = true;
    lastPublicRefreshRef.current = Date.now();
    setIsRefreshingBusinesses(true);
    setLoadError('');
    setPublicRefreshMessage('');
    try {
      const [publicRows, categoryResult] = await Promise.all([
        fetchPublicBusinesses(market),
        supabase.from('categories').select('id,name').eq('active', true).order('name')
      ]);
      setBusinesses(publicRows);
      if (!categoryResult.error) setAvailableCategories(categoryResult.data || []);
      const syncedAt = new Date().toISOString();
      setLastSuccessfulSync(syncedAt);
      try { localStorage.setItem(getMarketStorageKey('last-sync'), syncedAt); } catch { /* A sincronização continua válida nesta sessão. */ }
      setPublicRefreshMessage('Lista atualizada.');
    } catch {
      setLoadError('Não foi possível carregar os cadastros agora. Verifique sua conexão e tente novamente.');
    } finally {
      publicRefreshInFlightRef.current = false;
      setIsRefreshingBusinesses(false);
    }
  }

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

  const testPaginationMode = new URLSearchParams(window.location.search).get('teste-paginacao') === '1';
  const listingSource = useMemo(() => {
    const baseListings = isSupabaseConfigured ? businesses : examples;
    return testPaginationMode ? [...baseListings, ...paginationTestListings] : baseListings;
  }, [testPaginationMode, businesses]);
  const citySuggestions = useMemo(() => [...new Set(listingSource.flatMap(item => [
    item.city,
    ...String(item.service_cities || '').split(',')
  ]).filter(Boolean).map(value => value.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [listingSource]);
  const searchSuggestions = useMemo(() => {
    const terms = [
      ...Object.keys(searchSynonyms),
      ...categories.map(item => item.name),
      ...listingSource.flatMap(item => [item.name, item.category, item.tag])
    ];
    const typed = normalizeSearch(query);
    const unique = [...new Set(terms.map(value => String(value || '').trim()).filter(Boolean))];
    return unique
      .filter(value => !typed || normalizeSearch(value).includes(typed))
      .sort((a, b) => {
        const aStarts = normalizeSearch(a).startsWith(typed) ? 0 : 1;
        const bStarts = normalizeSearch(b).startsWith(typed) ? 0 : 1;
        return aStarts - bStarts || a.localeCompare(b, 'pt-BR');
      })
      .slice(0, 24);
  }, [listingSource, query]);
  const recordedPlanActivations = useMemo(() => adminAuditLogs
    .filter(log => log.entity_type === 'plano' && log.action === 'plano ativado por 30 dias')
    .map(log => {
      const planType = log.details?.plan_type;
      const amount = planType === 'destaque' ? 29.90 : planType === 'parceiro' ? 49.90 : 0;
      return { ...log, planType, amount };
    }).filter(log => log.amount > 0), [adminAuditLogs]);
  const reportRows = useMemo(() => recordedPlanActivations.filter(log => {
    const date = new Date(log.created_at);
    const [year, month] = selectedReportMonth.split('-').map(Number);
    return date.getFullYear() === year && date.getMonth() === month - 1;
  }), [recordedPlanActivations, selectedReportMonth]);
  const financeSummary = useMemo(() => ({
    total: reportRows.reduce((sum, log) => sum + log.amount, 0),
    count: reportRows.length,
    destaque: reportRows.filter(log => log.planType === 'destaque').length,
    parceiro: reportRows.filter(log => log.planType === 'parceiro').length,
  }), [reportRows]);
  function exportPlanReport(format) {
    const monthLabel = selectedReportMonth.split('-').reverse().join('/');
    const rows = reportRows.map(log => ({
      negocio: log.entity_name || 'Negócio',
      plano: log.planType === 'destaque' ? 'Destaque' : 'Parceiro',
      valor: log.amount.toFixed(2).replace('.', ','),
      data: new Date(log.created_at).toLocaleDateString('pt-BR'),
      responsavel: log.actor_email || 'Administrador'
    }));
    if (format === 'csv') {
      const quote = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
      const csv = ['Negócio;Plano;Valor (R$);Data;Responsável', ...rows.map(row => [row.negocio,row.plano,row.valor,row.data,row.responsavel].map(quote).join(';'))].join('\r\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'conecta-brasil-relatorio-' + selectedReportMonth + '.csv';
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) { setAdminError('Permita a abertura de janelas para gerar o PDF.'); return; }
    const safe = value => String(value ?? '').replace(/[&<>"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
    const body = rows.map(row => '<tr><td>'+safe(row.negocio)+'</td><td>'+safe(row.plano)+'</td><td>R$ '+safe(row.valor)+'</td><td>'+safe(row.data)+'</td><td>'+safe(row.responsavel)+'</td></tr>').join('');
    printWindow.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Conecta Brasil - '+safe(monthLabel)+'</title><style>body{font:14px Arial,sans-serif;padding:28px;color:#172b3a}h1{font-size:22px}p{color:#526575}.summary{display:flex;gap:28px;margin:22px 0;font-weight:bold}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #d8e1e8;padding:9px;text-align:left}th{background:#eef3f7}@media print{button{display:none}}</style></head><body><h1>Conecta Brasil — Relatório de planos</h1><p>Referência: '+safe(monthLabel)+'</p><div class="summary"><span>Total registrado: R$ '+financeSummary.total.toLocaleString('pt-BR',{minimumFractionDigits:2})+'</span><span>Ativações: '+financeSummary.count+'</span></div><table><thead><tr><th>Negócio</th><th>Plano</th><th>Valor</th><th>Data</th><th>Responsável</th></tr></thead><tbody>'+body+'</tbody></table><p>Relatório estimativo com base nas ativações administrativas registradas. Não representa confirmação bancária.</p><script>window.onload=()=>window.print();</script></body></html>');
    printWindow.document.close();
  }
  const adminPlanStatus = item => {
    const type = item.plan_type || (item.featured ? 'destaque' : 'gratuito');
    const expiry = item.plan_expires_at || item.featured_expires_at;
    const expiryTime = expiry ? new Date(expiry).getTime() : null;
    const isPaid = ['destaque','parceiro'].includes(type);
    const isExpired = isPaid && expiryTime !== null && expiryTime <= Date.now();
    const isActive = item.status === 'approved' && isPaid && !isExpired;
    const isExpiring = isActive && expiryTime !== null && expiryTime <= Date.now() + 7 * 24 * 60 * 60 * 1000;
    return { type, isPaid, isExpired, isActive, isExpiring };
  };
  const adminOverview = useMemo(() => {
    const now = Date.now();
    const approved = adminBusinesses.filter(item => item.status === 'approved');
    const pending = adminBusinesses.filter(item => item.status === 'pending');
    const plans = adminBusinesses.map(item => ({ item, ...adminPlanStatus(item) }));
    const active = plans.filter(row => row.isActive);
    const expired = plans.filter(row => row.isExpired);
    const expiring = plans.filter(row => row.isExpiring).sort((a,b) => new Date(a.item.plan_expires_at || a.item.featured_expires_at) - new Date(b.item.plan_expires_at || b.item.featured_expires_at));
    return {
      total: adminBusinesses.length, approved: approved.length, pending: pending.length,
      views: approved.reduce((sum,item)=>sum+Number(item.views_count || 0),0),
      whatsappClicks: approved.reduce((sum,item)=>sum+Number(item.whatsapp_clicks || 0),0),
      topViewed: [...approved].sort((a,b)=>Number(b.views_count || 0)-Number(a.views_count || 0)).slice(0,5),
      topContacted: [...approved].sort((a,b)=>Number(b.whatsapp_clicks || 0)-Number(a.whatsapp_clicks || 0)).slice(0,5),
      free: approved.filter(item => !plans.find(row => row.item.id === item.id)?.isActive).length,
      destaque: active.filter(row => row.type === 'destaque').length,
      parceiro: active.filter(row => row.type === 'parceiro').length,
      expired: expired.length, expiring, expiredItems: expired.sort((a,b) => new Date(a.item.plan_expires_at || a.item.featured_expires_at) - new Date(b.item.plan_expires_at || b.item.featured_expires_at)),
      checkedAt: now
    };
  }, [adminBusinesses]);
  const filteredAdminBusinesses = useMemo(() => adminBusinesses.filter(item => {
    const plan = adminPlanStatus(item);
    const matchesFilter = adminFilter === 'all' ? true
      : adminFilter === 'featured' ? item.featured
      : adminFilter === 'expiring' ? plan.isExpiring
      : adminFilter === 'expired' ? plan.isExpired
      : adminFilter === 'free' ? item.status === 'approved' && !plan.isActive
      : adminFilter === 'destaque' ? plan.isActive && plan.type === 'destaque'
      : adminFilter === 'parceiro' ? plan.isActive && plan.type === 'parceiro'
      : item.status === adminFilter;
    return matchesFilter && normalizeSearch([item.name, item.city, item.state, item.phone].filter(Boolean).join(' ')).includes(normalizeSearch(adminSearch));
  }), [adminBusinesses, adminFilter, adminSearch]);
  const filtered = useMemo(() => listingSource.filter(item => {
    const searchable = normalizeSearch([
      item.name, item.desc, item.category, item.tag, item.city, item.service_cities,
      item.neighborhood, item.phone
    ].join(' '));
    const queryTokens = normalizeSearch(query).split(/\s+/).filter(term => term && !searchStopWords.has(term));
    const matchesSearch = !queryTokens.length || queryTokens.every(term =>
      searchable.includes(term) ||
      (searchSynonyms[term] || []).some(alias => searchable.includes(normalizeSearch(alias)))
    );
    return (active === 'Todas' || item.category === active) &&
      matchesSearch &&
      (!city || normalizeSearch([item.city, item.service_cities].join(' ')).includes(normalizeSearch(city))) &&
      (!showFavorites || favoriteIds.includes(String(item.id || item.name)));
  }), [listingSource, query, active, city, showFavorites, favoriteIds]);
  const listingPageCount = Math.max(1, Math.ceil(filtered.length / listingPageSize));
  const visibleListings = filtered.slice((listingPage - 1) * listingPageSize, listingPage * listingPageSize);
  useEffect(() => { setListingPage(1); }, [query, city, active, showFavorites, favoriteIds, listingSource]);
  useEffect(() => { if (listingPage > listingPageCount) setListingPage(listingPageCount); }, [listingPage, listingPageCount]);
  const ownerStats = useMemo(() => ({
    total: ownerBusinesses.length,
    pending: ownerBusinesses.filter(item => item.status === 'pending').length,
    approved: ownerBusinesses.filter(item => item.status === 'approved').length,
    attention: ownerBusinesses.filter(item => ['rejected','suspended'].includes(item.status)).length
  }), [ownerBusinesses]);
  const filteredOwnerBusinesses = useMemo(() => ownerBusinesses.filter(item => {
    const matchesStatus = ownerFilter === 'all' || (ownerFilter === 'attention' ? ['rejected','suspended'].includes(item.status) : item.status === ownerFilter);
    const searchable = normalizeSearch([item.name, item.city, item.state, item.description, item.status].join(' '));
    return matchesStatus && searchable.includes(normalizeSearch(ownerSearch));
  }).sort((a, b) => {
    if (ownerSort === 'name') return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    const aDate = new Date(a.created_at || 0).getTime();
    const bDate = new Date(b.created_at || 0).getTime();
    return ownerSort === 'oldest' ? aDate - bDate : bDate - aDate;
  }), [ownerBusinesses, ownerFilter, ownerSearch, ownerSort]);
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
    {!isOnline && <div className="connection-banner" role="status"><strong>Você está offline.</strong> {businesses.length ? 'Exibindo a última lista disponível neste dispositivo. Novos dados e envio de cadastros precisam de internet.' : 'A vitrine pode abrir, mas carregar anúncios e enviar cadastros exige internet.'} <span>As alterações não são enviadas automaticamente.</span></div>}{isOnline && loadError && <div className="cache-status" role="status"><strong>{businesses.length ? 'Última lista disponível.' : 'Não foi possível carregar a vitrine.'}</strong> {businesses.length ? 'A atualização online falhou; os dados locais continuam visíveis.' : 'Confira sua conexão e tente novamente.'} <button type="button" onClick={retryPublicBusinesses} disabled={loadingBusinesses || isRefreshingBusinesses}>{loadingBusinesses || isRefreshingBusinesses ? 'Atualizando...' : 'Tentar novamente'}</button></div>}
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark"><span></span><span></span><span></span></span><span>conecta<span className="brand-light">brasil</span><small>CONEXÕES QUE MOVIMENTAM</small></span></a>
      <button className="mobile-menu" type="button" onClick={() => setMenu(!menu)} aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} aria-controls="main-navigation">{menu ? <X/> : <Menu/>}</button>
      <nav id="main-navigation" className={menu ? 'nav open' : 'nav'}><a href="#categorias" onClick={()=>setMenu(false)}>Categorias</a><a href="#explorar" onClick={()=>setMenu(false)}>Explorar</a><a href="#sobre" onClick={()=>setMenu(false)}>Sobre</a><a href="#planos" onClick={()=>setMenu(false)}>Planos</a>{!appInstalled && <div className="install-menu-wrap"><button type="button" className="btn btn-small install-nav" aria-expanded={installHelpOpen} aria-controls="install-help" onClick={()=>{if(installPrompt){installApp();setMenu(false)}else setInstallHelpOpen(value=>!value)}}><Download size={16}/> {installPrompt ? 'Instalar aplicativo' : 'Como instalar'}</button>{installHelpOpen && !installPrompt && <div className="install-help" id="install-help" role="region" aria-label="Instruções para instalar o Conecta Brasil"><strong>Instale no seu dispositivo</strong><p><b>Android (Chrome):</b> abra o menu ⋮ do navegador e escolha “Instalar app” ou “Adicionar à tela inicial”.</p><p><b>iPhone (Safari):</b> toque em Compartilhar e depois em “Adicionar à Tela de Início”.</p><p><b>Computador:</b> procure o ícone de instalação na barra de endereço ou a opção “Instalar Conecta Brasil” no menu do navegador.</p><button type="button" className="install-help-close" onClick={()=>setInstallHelpOpen(false)}>Fechar</button></div>}</div>}{isAdmin && <button type="button" className="btn btn-small admin-nav" onClick={()=>{setShowForm(true);setMenu(false)}}><ShieldCheck size={16}/> Administração</button>}<button type="button" className="btn btn-small" onClick={()=>{setShowForm(true);setMenu(false)}}><Plus size={16}/> Anunciar negócio</button></nav>
    </header>
    <main>
      <section className="hero"><div className="hero-glow"></div><div className="hero-content"><div className="eyebrow"><Sparkles size={15}/> UM BRASIL DE OPORTUNIDADES</div><h1>O que você procura.<br/><em>Mais perto de você.</em></h1><p>Encontre empresas, profissionais, lojas e serviços. Valorize quem faz a economia acontecer em cada cidade do Brasil.</p>
        <div className="search-panel"><label className="search-field"><Search size={20}/><input type="search" list="search-suggestions" maxLength="120" aria-label="Produto, serviço ou negócio que procura" value={query} onChange={e=>setQuery(e.target.value)} placeholder="O que você está procurando?"/><datalist id="search-suggestions">{searchSuggestions.map(value=><option key={value} value={value}/>)}</datalist></label><span className="search-divider"></span><label className="search-field city-field"><MapPin size={20}/><input type="search" list="city-suggestions" maxLength="80" aria-label="Filtrar por cidade ou região" value={city} onChange={e=>setCity(e.target.value)} placeholder="Cidade ou região"/><datalist id="city-suggestions">{citySuggestions.map(value=><option key={value} value={value}/>)}</datalist></label><button type="button" className="btn search-btn" aria-label="Buscar negócios com os filtros informados" onClick={()=>document.getElementById('explorar').scrollIntoView({behavior:'smooth'})}>Buscar <ArrowRight size={17}/></button><button type="button" className="voice-search-btn" onClick={startVoiceSearch} aria-label="Pesquisar por voz" title="Pesquisar por voz"><Mic size={17}/></button><button type="button" className="voice-search-btn location-search-btn" onClick={openNearbyMap} aria-label="Encontrar negócios perto de mim" title="Encontrar negócios perto de mim"><LocateFixed size={17}/></button></div>{(voiceMessage || isListening || locationMessage) && <div className="voice-search-status" role="status">{isListening ? "Ouvindo..." : [voiceMessage,locationMessage].filter(Boolean).join(" ")}{nearbyMapUrl && <a className="nearby-map-result" href={nearbyMapUrl} target="_blank" rel="noopener noreferrer">Ver mapa da minha localização</a>}</div>}
        <div style={{marginTop:14,maxWidth:670}}>
          <button type="button" onClick={()=>setGuideOpen(open=>!open)} aria-expanded={guideOpen} style={{display:'inline-flex',alignItems:'center',gap:8,border:'1px solid rgba(255,255,255,.28)',borderRadius:999,padding:'9px 14px',background:'rgba(255,255,255,.09)',color:'#fff',font:'700 12px inherit',cursor:'pointer'}}>
            <Sparkles size={15}/> {guideOpen ? 'Fechar guia de busca' : 'Não sabe o que procurar? Receba uma ajuda'}
          </button>
          {guideOpen && <div style={{marginTop:10,padding:15,borderRadius:14,background:'#fff',color:'#183047',boxShadow:'0 12px 30px rgba(0,0,0,.14)'}}>
            <strong style={{display:'block',fontSize:14,marginBottom:5}}>Vamos encontrar o que você precisa</strong>
            <p style={{margin:'0 0 12px',fontSize:12,lineHeight:1.5,color:'#617286'}}>Escolha uma necessidade. O guia preenche a busca com termos relacionados aos cadastros disponíveis — sem inventar empresas ou resultados.</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {[
                ['Reformar ou construir','pedreiro reforma construção'],
                ['Instalação elétrica ou hidráulica','eletricista encanador instalação'],
                ['Gesso, forro ou drywall','gesseiro gesso forro drywall'],
                ['Limpeza e serviços domésticos','diarista limpeza faxina'],
                ['Lojas e produtos','loja comércio produtos'],
                ['Alimentação e restaurantes','restaurante mercado alimentação'],
                ['Serviços profissionais','advogado dentista profissional']
              ].map(([label,term])=><button key={term} type="button" onClick={()=>{setQuery(term);setGuideOpen(false);document.getElementById('explorar')?.scrollIntoView({behavior:'smooth'});}} style={{border:'1px solid #dce7ed',borderRadius:999,padding:'8px 11px',background:'#f5f9fb',color:'#17466b',font:'700 11px inherit',cursor:'pointer'}}>{label}</button>)}
            </div>
          </div>}
        </div>
        <div className="hero-note"><ShieldCheck size={15}/> Uma plataforma para conectar pessoas e negócios.</div>
      </div><div className="hero-art"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="map-card"><div className="map-lines"></div><div className="pin pin-a"><MapPin/></div><div className="pin pin-b"><MapPin/></div><div className="pin pin-c"><MapPin/></div><div className="map-center"><span>BR</span><b>Brasil</b><small>Grandes conexões começam localmente</small></div></div><div className="float-card float-top"><span className="float-icon"><Store/></span><span><b>Negócios locais</b><small>Ganham visibilidade</small></span></div><div className="float-card float-bottom"><span className="float-icon green"><Heart/></span><span><b>Comunidade forte</b><small>Todo mundo conectado</small></span></div></div></section>
      <section className="trust-strip"><div><b>1 só lugar</b><span>para encontrar</span></div><i></i><div><b>Seu município</b><span>como ponto de partida</span></div><i></i><div><b>Todo o Brasil</b><span>como horizonte</span></div></section>
      <section className="section categories" id="categorias"><div className="section-heading"><div><div className="eyebrow dark">EXPLORE POSSIBILIDADES</div><h2>O Brasil tem de tudo.<br/><em>Encontre aqui.</em></h2></div><p>Uma vitrine para negócios de todos os tamanhos e uma busca simples para quem precisa encontrar soluções.</p></div><div className="category-grid">{publicCategories.map(({name,icon:Icon,count},i)=><button type="button" className="category-card" key={name} onClick={()=>{setActive(name);document.getElementById('explorar').scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}}><span className={'cat-icon cat-'+i}><Icon size={23}/></span><b>{name}</b><small>{count}</small><ArrowRight className="cat-arrow" size={18}/></button>)}</div></section>
      <section className="explore-section" id="explorar"><div className="section-heading explore-heading"><div><div className="eyebrow dark">VITRINE CONECTA BRASIL</div><h2>Descubra o que existe <em>por perto.</em></h2></div><span className="demo-label">{testPaginationMode ? 'MODO DE TESTE — DADOS FICTÍCIOS' : (isSupabaseConfigured ? 'NEGÓCIOS CADASTRADOS' : 'MODO DE DEMONSTRAÇÃO')}</span></div><div className="filters"><div className="filter-pills">{['Todas',...publicCategories.map(c=>c.name)].map(c=><button key={c} type="button" className={active===c?'selected':''} aria-pressed={active===c} onClick={()=>setActive(c)}>{c}</button>)}</div><div className="filter-tools"><span className={isOnline ? 'sync-indicator online' : 'sync-indicator offline'} role="status" aria-live="polite"><i aria-hidden="true"></i>{!isOnline ? 'Offline' : isRefreshingBusinesses ? 'Sincronizando…' : loadError ? 'Sincronização pendente' : lastSuccessfulSync ? `Atualizado ${new Date(lastSuccessfulSync).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` : 'Aguardando sincronização'}</span><button type="button" className={showFavorites ? "favorites-filter active" : "favorites-filter"} aria-pressed={showFavorites} onClick={()=>setShowFavorites(!showFavorites)}><Heart size={14} fill={showFavorites ? "currentColor" : "none"}/> Favoritos ({favoriteIds.length})</button>{isSupabaseConfigured && <button type="button" className="listing-refresh" onClick={retryPublicBusinesses} disabled={loadingBusinesses || isRefreshingBusinesses || !isOnline} aria-label="Atualizar lista de negócios" title={!isOnline ? 'Conecte-se à internet para atualizar' : 'Buscar anúncios atualizados'}>{loadingBusinesses || isRefreshingBusinesses ? 'Atualizando...' : 'Atualizar anúncios'}</button>}{publicRefreshMessage && <span className="listing-refresh-feedback" role="status" aria-live="polite">{publicRefreshMessage}</span>}<span className="results-summary" role="status" aria-live="polite" aria-atomic="true">{filtered.length} {filtered.length === 1 ? 'negócio encontrado' : 'negócios encontrados'}{city ? ` em “${city}”` : ''}{hasActiveFilters && <button type="button" className="clear-city-filter" onClick={clearFilters}>Limpar filtros</button>}</span></div></div><div className="listing-grid">{loadingBusinesses ? <div className="empty-state">Carregando negócios cadastrados...</div> : filtered.length ? visibleListings.map((item,i)=>{const Icon=item.icon;return <article className="listing-card" key={item.id || item.name}><div className={'listing-visual visual-'+i}>{item.photos?.[0] ? <img className="listing-cover photo-selectable" src={item.photos[0]} decoding="async" alt={`Foto de ${item.name}`} loading="lazy" role="button" tabIndex={0} title="Clique para ampliar" onClick={()=>setSelectedPhoto({src:item.photos[0],name:item.name})} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedPhoto({src:item.photos[0],name:item.name})}}}/> : <Icon size={32} />}{item.logo && <img className="listing-logo photo-selectable" src={item.logo} decoding="async" alt={`Logo ${item.name}`} loading="lazy" role="button" tabIndex={0} aria-label={`Ampliar logo de ${item.name}`} title="Clique para ampliar" onClick={()=>setSelectedPhoto({src:item.logo,name:item.name+' — logo'})} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedPhoto({src:item.logo,name:item.name+' — logo'})}}}/>}<span>{item.tag}</span><button type="button" className={favoriteIds.includes(String(item.id || item.name)) ? "listing-favorite saved" : "listing-favorite"} aria-pressed={favoriteIds.includes(String(item.id || item.name))} onClick={()=>toggleFavorite(item)} aria-label={favoriteIds.includes(String(item.id || item.name)) ? "Remover dos favoritos" : "Adicionar aos favoritos"} title={favoriteIds.includes(String(item.id || item.name)) ? "Remover dos favoritos" : "Adicionar aos favoritos"}><Heart size={17} fill={favoriteIds.includes(String(item.id || item.name)) ? "currentColor" : "none"}/></button>{item.featured && <strong className="listing-featured"><Star size={11} fill="currentColor"/> Destaque</strong>}</div>{item.photos?.length > 1 && <div className="listing-gallery">{item.photos.slice(1,5).map((url,index)=><img className="photo-selectable" key={url} src={url} alt={`Foto ${index+2} de ${item.name}`} loading="lazy" role="button" tabIndex={0} title="Clique para ampliar" onClick={()=>setSelectedPhoto({src:url,name:item.name})} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedPhoto({src:url,name:item.name})}}}/>)}</div>}<div className="listing-body"><small>{item.category}</small><h3>{item.name} {item.verified && <span className="verified-badge" title="Cadastro verificado pela equipe Conecta Brasil"><ShieldCheck size={14}/> Verificado</span>}</h3><p>{item.desc}</p><div className="listing-foot"><span><MapPin size={14}/>{item.city}</span><button type="button" className="listing-details-button" onClick={()=>openBusinessDetails(item)}>Ver detalhes</button>{whatsappLink(item.phone) ? <a className="listing-contact" href={whatsappLink(item.phone, `Olá! Encontrei ${item.name} no Conecta Brasil e gostaria de solicitar um orçamento. Poderia me atender?`)} target="_blank" rel="noopener noreferrer" onClick={()=>trackBusinessMetric(item, 'whatsapp_clicks')} aria-label={`Solicitar orçamento com ${item.name} pelo WhatsApp`}>Pedir orçamento <ArrowRight size={14}/></a> : <span className="coming">Contato não informado</span>}</div></div></article>}) : <div className="empty-state">{loadError || (isSupabaseConfigured ? 'Nenhum negócio encontrado com esses filtros.' : 'Nenhum resultado nesta prévia. Experimente outra categoria.')}{loadError && <button type="button" className="reset-search-button" onClick={retryPublicBusinesses} disabled={loadingBusinesses || isRefreshingBusinesses || !isOnline}>{loadingBusinesses || isRefreshingBusinesses ? 'Tentando novamente...' : !isOnline ? 'Aguardando conexão' : 'Tentar carregar novamente'}</button>}{hasActiveFilters && <button type="button" className="reset-search-button" onClick={clearFilters}>Limpar filtros e ver todos</button>}</div>}</div>{filtered.length > listingPageSize && <nav className="listing-pagination" aria-label="Paginação dos negócios"><span role="status" aria-live="polite" aria-atomic="true">Página {listingPage} de {listingPageCount}</span><div><button type="button" aria-label="Ir para a página anterior" onClick={()=>changeListingPage(-1)} disabled={listingPage===1}>Anterior</button><button type="button" aria-label="Ir para a próxima página" onClick={()=>changeListingPage(1)} disabled={listingPage===listingPageCount}>Próxima</button></div></nav>}</section>
      <section className="plans-section" id="planos">
        <div className="plans-heading"><div className="eyebrow dark">CRESÇA COM O CONECTA BRASIL</div><h2>Escolha como divulgar seu negócio</h2><p>Comece gratuitamente e conheça as opções de divulgação para ampliar sua visibilidade.</p></div>
        <div className="plans-grid">
          <article className="plan-card"><span className="plan-label">PARA COMEÇAR</span><h3>Gratuito</h3><div className="plan-price">R$ 0 <small>/ sempre</small></div><ul><li>Cadastro do negócio na vitrine</li><li>Perfil público com contato pelo WhatsApp</li><li>Compartilhamento do perfil e QR Code</li></ul><button type="button" className="plan-button" onClick={()=>{setShowForm(true);setSent(false);setMenu(false)}}>Cadastrar negócio</button></article>
          <article className="plan-card plan-card-featured"><span className="plan-label">MAIS VISIBILIDADE</span><h3>Destaque</h3><div className="plan-price">R$ 29,90 <small>/ 30 dias</small></div><ul><li>Todos os recursos do cadastro gratuito</li><li>Anúncio marcado como destaque na vitrine</li><li>Mais evidência para quem explora os negócios</li></ul><a className="plan-button plan-button-primary" href="https://wa.me/5511976983978?text=Ol%C3%A1!%20Tenho%20interesse%20no%20plano%20Destaque%20do%20Conecta%20Brasil%20(R%24%2029%2C90%20por%2030%20dias).%20Gostaria%20de%20receber%20informa%C3%A7%C3%B5es%20sobre%20as%20condi%C3%A7%C3%B5es." target="_blank" rel="noopener noreferrer">Solicitar informações</a></article>
          <article className="plan-card"><span className="plan-label">DIVULGAÇÃO AMPLIADA</span><h3>Parceiro</h3><div className="plan-price">R$ 49,90 <small>/ 30 dias</small></div><ul><li>Todos os recursos do cadastro gratuito</li><li>Destaque na vitrine por 30 dias</li><li>Apoio para preparar texto de divulgação</li></ul><a className="plan-button" href="https://wa.me/5511976983978?text=Ol%C3%A1!%20Tenho%20interesse%20no%20plano%20Parceiro%20do%20Conecta%20Brasil%20(R%24%2049%2C90%20por%2030%20dias).%20Gostaria%20de%20receber%20informa%C3%A7%C3%B5es%20sobre%20as%20condi%C3%A7%C3%B5es." target="_blank" rel="noopener noreferrer">Solicitar informações</a></article>
        </div>
        <p className="plans-disclaimer">Valores iniciais sugeridos para lançamento. O botão abre uma conversa no WhatsApp para solicitar informações; não realiza cobrança nem confirma contratação. O cadastro gratuito continua disponível.</p>
      </section>
      <section className="cta" id="sobre"><div className="cta-orb"></div><div><div className="eyebrow">FAÇA PARTE DESSA CONEXÃO</div><h2>Seu negócio merece<br/>ser encontrado.</h2><p>Dê visibilidade ao seu trabalho e conecte seu negócio a pessoas que procuram produtos e serviços na sua região.</p></div><button type="button" className="btn cta-btn" onClick={()=>{setShowForm(true);setSent(false)}}>Quero anunciar <ArrowRight size={17}/></button></section>
    </main>
    <footer><a className="brand footer-brand" href="#"><span className="brand-mark"><span></span><span></span><span></span></span><span>conecta<span className="brand-light">brasil</span><small>CONEXÕES QUE MOVIMENTAM</small></span></a><span>© 2026 Conecta Brasil. Um país inteiro de possibilidades.</span><span className="footer-status"><i></i> Conectando pessoas e negócios</span></footer>
    {selectedBusiness && <div className="business-detail-backdrop" role="dialog" aria-modal="true" aria-label={`Detalhes de ${selectedBusiness.name}`} onClick={closeBusinessDetails}><section className="business-detail" onClick={e=>e.stopPropagation()}><button type="button" className="business-detail-close" onClick={closeBusinessDetails} aria-label="Fechar detalhes"><X size={22}/></button><div className="business-detail-hero">{selectedBusiness.photos?.[0] ? <img src={selectedBusiness.photos[0]} alt={`Foto de ${selectedBusiness.name}`}/> : selectedBusiness.logo ? <img src={selectedBusiness.logo} alt={`Logo de ${selectedBusiness.name}`}/> : <Store size={46}/>}</div><div className="business-detail-content"><small>{selectedBusiness.category}</small><h2>{selectedBusiness.name} {selectedBusiness.verified && <span className="verified-badge"><ShieldCheck size={15}/> Verificado</span>}</h2>{selectedBusiness.featured && <strong className="detail-featured"><Star size={13} fill="currentColor"/> Negócio em destaque</strong>}<p>{selectedBusiness.desc}</p><div className="business-detail-location"><MapPin size={17}/>{selectedBusiness.location_visibility === 'exact' ? [selectedBusiness.street, selectedBusiness.street_number, selectedBusiness.neighborhood, selectedBusiness.city].filter(Boolean).join(', ') : selectedBusiness.location_visibility === 'service_area' ? (selectedBusiness.service_cities || selectedBusiness.city || 'Área de atendimento') : [selectedBusiness.neighborhood, selectedBusiness.city].filter(Boolean).join(' - ') || selectedBusiness.city || 'Localização não informada'}</div>{selectedBusiness.location_visibility === 'service_area' && <small>Este negócio atende em diferentes localidades; o endereço exato não é divulgado.</small>}{businessMapLink(selectedBusiness) && <a className="business-map-link" href={businessMapLink(selectedBusiness)} target="_blank" rel="noopener noreferrer"><MapPin size={15}/> {selectedBusiness.location_visibility === 'exact' ? 'Ver endereço no mapa' : selectedBusiness.location_visibility === 'service_area' ? 'Ver área de atendimento' : 'Ver região no mapa'}</a>}{businessDirectionsLink(selectedBusiness) && <a className="business-map-link business-directions-link" href={businessDirectionsLink(selectedBusiness)} target="_blank" rel="noopener noreferrer" aria-label={selectedBusiness.location_visibility === 'exact' ? 'Traçar rota até o endereço comercial' : 'Consultar rota aproximada até a região'}><ArrowRight size={15}/> {selectedBusiness.location_visibility === 'exact' ? 'Como chegar' : 'Rota aproximada'}</a>}{selectedBusiness.photos?.length > 0 && <div className="business-detail-gallery">{selectedBusiness.photos.slice(0,5).map((url,index)=><img key={url} src={url} alt={`Foto ${index+1} de ${selectedBusiness.name}`} loading="lazy" decoding="async" role="button" tabIndex={0} title="Clique para ampliar" aria-label={`Ampliar foto ${index+1} de ${selectedBusiness.name}`} onClick={()=>setSelectedPhoto({src:url,name:selectedBusiness.name})} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelectedPhoto({src:url,name:selectedBusiness.name})}}}/>)}</div>}<div className="business-detail-actions">{whatsappLink(selectedBusiness.phone) && <a className="listing-contact business-detail-contact" href={whatsappLink(selectedBusiness.phone, `Olá! Encontrei ${selectedBusiness.name} no Conecta Brasil e gostaria de solicitar um orçamento. Poderia me atender?`)} target="_blank" rel="noopener noreferrer" onClick={()=>trackBusinessMetric(selectedBusiness, 'whatsapp_clicks')}>Solicitar orçamento pelo WhatsApp <ArrowRight size={16}/></a>}<button type="button" className="business-share-button" onClick={()=>shareBusiness(selectedBusiness)}><Share2 size={16}/> Compartilhar negócio</button></div>{shareMessage && <small className="share-feedback">{shareMessage}</small>}<div className="business-qr-card"><div><strong>Compartilhe também por QR Code</strong><small>Escaneie com a câmera do celular para abrir este anúncio.</small></div>{businessQr ? <a href={businessQr} download={`qr-${String(selectedBusiness.name || "negocio").toLowerCase().replace(/[^a-z0-9]+/g,"-")}.png`} aria-label="Baixar QR Code do negócio"><img src={businessQr} alt={`QR Code para abrir o anúncio de ${selectedBusiness.name}`} /></a> : <small role="status">{qrError || "Gerando QR Code..."}</small>}</div><section className="business-reviews" style={{marginTop:22,paddingTop:18,borderTop:"1px solid #e5edf2"}}><h3>Avaliações</h3>{businessReviews.length ? <><strong style={{fontSize:22}}>{(businessReviews.reduce((sum,item)=>sum+Number(item.rating),0)/businessReviews.length).toFixed(1).replace(".",",")} / 5</strong><span style={{color:"#d58a12",marginLeft:8}}>{"★".repeat(Math.round(businessReviews.reduce((sum,item)=>sum+Number(item.rating),0)/businessReviews.length))}</span><small style={{display:"block",color:"#64748b"}}>{businessReviews.length} avaliação(ões) publicada(s)</small>{businessReviews.map(review=><article key={review.id} style={{padding:"12px 0",borderBottom:"1px solid #edf1f4"}}><strong style={{color:"#d58a12"}}>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</strong><p>{review.comment}</p><small>{new Date(review.created_at).toLocaleDateString("pt-BR")}</small></article>)}</> : <p>Este negócio ainda não recebeu avaliações.</p>}{authUser ? <form onSubmit={submitBusinessReview} className="business-review-form"><strong>Conte como foi sua experiência</strong><label className="review-field">Nota<select className="review-rating-select" value={reviewRating} onChange={e=>setReviewRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} estrela(s)</option>)}</select></label><label className="review-field">Comentário<textarea className="review-comment-input" value={reviewComment} onChange={e=>setReviewComment(e.target.value)} minLength={5} maxLength={1000} rows={4} placeholder="Conte como foi sua experiência (5 a 1.000 caracteres)" required/></label><button className="btn" type="submit" disabled={reviewBusy}>{reviewBusy?"Enviando...":"Enviar avaliação"}</button></form> : <p>Entre na sua conta para avaliar este negócio.</p>}{reviewMessage && <p role="status" style={{color:"#18794e"}}>{reviewMessage}</p>}{reviewError && <p role="alert" style={{color:"#b42318"}}>{reviewError}</p>}<small>As avaliações representam opiniões de usuários e não comprovam contratação. Os comentários passam por moderação.</small></section>{!whatsappLink(selectedBusiness.phone) && <span className="coming">Contato não informado</span>}</div></section></div>}
    {selectedPhoto && <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={`Foto ampliada de ${selectedPhoto.name}`} onClick={()=>setSelectedPhoto(null)}><button type="button" className="photo-lightbox-close" aria-label="Fechar imagem" onClick={()=>setSelectedPhoto(null)}><X size={24}/></button><div className="photo-lightbox-content" onClick={e=>e.stopPropagation()}><img src={selectedPhoto.src} alt={selectedPhoto.name}/><span>{selectedPhoto.name}</span></div></div>}
    {showForm && <div className="modal-backdrop" onClick={()=>setShowForm(false)}><div className="modal" role="dialog" aria-modal="true" aria-label="Área de cadastro e administração do Conecta Brasil" onClick={e=>e.stopPropagation()}>
      <button type="button" className="modal-close" onClick={()=>setShowForm(false)} aria-label="Fechar janela"><X/></button>
      {isAdmin ? <>
        <div className="eyebrow dark">ÁREA RESTRITA</div>
        <div className="admin-panel-heading">
          <div><h2>Painel administrativo</h2>
          <p>Revise os anúncios enviados e escolha quais podem aparecer publicamente na vitrine.</p></div>
          <button type="button" className="admin-refresh-button" onClick={loadAdminBusinesses} disabled={adminLoading || formBusy} aria-label="Atualizar painel administrativo">
            <span aria-hidden="true">↻</span> {adminLoading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
        <section className="admin-category-manager" style={{margin:"16px 0",padding:16,border:"1px solid #dbe6ed",borderRadius:16,background:"#fff"}}>
          <h3>Avaliações dos negócios</h3><p>Revise os comentários antes de publicá-los. Somente avaliações aprovadas aparecem nos perfis.</p>
          {adminReviewsError && <p role="alert">{adminReviewsError}</p>}
          {adminReviewsLoading ? <p>Carregando avaliações...</p> : adminReviews.length ? adminReviews.map(review=><article key={review.id} style={{padding:"12px 0",borderTop:"1px solid #e5edf2"}}><strong>{review.businesses?.name || "Negócio"} · <span style={{color:"#d58a12"}}>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span></strong><p>{review.comment}</p><small>{new Date(review.created_at).toLocaleString("pt-BR")} · {({pending:"Aguardando análise",approved:"Aprovada",rejected:"Rejeitada"})[review.status] || review.status}</small><div className="admin-actions">{review.status !== "approved" && <button type="button" className="approve-action" disabled={formBusy} onClick={()=>moderateReview(review,"approved")}>Aprovar</button>}{review.status !== "rejected" && <button type="button" disabled={formBusy} onClick={()=>moderateReview(review,"rejected")}>Rejeitar</button>}</div></article>) : <p>Nenhuma avaliação recebida até agora.</p>}
        </section>
        <section className="admin-category-manager admin-central-dashboard" style={{margin:'16px 0',padding:16,border:'1px solid #dbe6ed',borderRadius:16,background:'linear-gradient(145deg,#f7fbfd,#eef6f4)'}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'center'}}>
            <div><div className="eyebrow dark">VISÃO GERAL</div><h3 style={{margin:'4px 0'}}>Central de gestão</h3><p style={{margin:0}}>Indicadores calculados sobre os cadastros carregados no painel.</p></div>
            <small style={{color:'#64748b'}}>Atualizado em {new Date(adminOverview.checkedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small>
          </div>
          {(adminOverview.pending > 0 || adminOverview.expiring.length > 0 || adminOverview.expired > 0) && <div role="status" aria-live="polite" style={{margin:'12px 0',padding:14,border:'1px solid #f2d39a',borderRadius:12,background:'#fffaf0'}}>
            <strong style={{display:'block',marginBottom:6}}>Atenção administrativa</strong>
            <p style={{margin:'0 0 10px',fontSize:13,color:'#72551e'}}>{[
              adminOverview.pending ? adminOverview.pending + ' cadastro(s) aguardando aprovação' : '',
              adminOverview.expiring.length ? adminOverview.expiring.length + ' plano(s) vencem nos próximos 7 dias' : '',
              adminOverview.expired ? adminOverview.expired + ' plano(s) vencido(s)' : ''
            ].filter(Boolean).join(' · ')}.</p>
            <div className="admin-actions">
              {adminOverview.pending > 0 && <button type="button" onClick={()=>setAdminFilter('pending')}>Revisar pendentes</button>}
              {adminOverview.expiring.length > 0 && <button type="button" onClick={()=>setAdminFilter('expiring')}>Ver renovações próximas</button>}
              {adminOverview.expired > 0 && <button type="button" onClick={()=>setAdminFilter('expired')}>Ver planos vencidos</button>}
            </div>
          </div>}
          <div className="admin-stats" style={{margin:'14px 0 8px'}}>
            <button type="button" className="admin-stat-button" onClick={()=>setAdminFilter('all')}><b>{adminOverview.total}</b><span>Total de negócios</span></button>
            <button type="button" className="admin-stat-button" onClick={()=>setAdminFilter('approved')}><b>{adminOverview.approved}</b><span>Aprovados</span></button>
            <button type="button" className="admin-stat-button" onClick={()=>setAdminFilter('pending')}><b>{adminOverview.pending}</b><span>Aguardando análise</span></button>
            <button type="button" className="admin-stat-button" onClick={()=>setAdminFilter('free')}><b>{adminOverview.free}</b><span>Gratuitos ativos</span></button>
            <button type="button" className="admin-stat-button" onClick={()=>setAdminFilter('destaque')}><b>{adminOverview.destaque}</b><span>Destaque ativo</span></button>
            <button type="button" className="admin-stat-button" onClick={()=>setAdminFilter('parceiro')}><b>{adminOverview.parceiro}</b><span>Parceiro ativo</span></button>
            <button type="button" className="admin-stat-button" onClick={()=>setAdminFilter('expiring')}><b>{adminOverview.expiring.length}</b><span>Vencem em até 7 dias</span></button>
            <button type="button" className="admin-stat-button" onClick={()=>setAdminFilter('expired')}><b>{adminOverview.expired}</b><span>Planos vencidos</span></button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12,marginTop:12}}>
            <div style={{background:'#fff',border:'1px solid #e0e8ed',borderRadius:12,padding:12}}>
              <strong style={{display:'block',marginBottom:8}}>Vencimentos próximos</strong>
              {adminOverview.expiring.length ? adminOverview.expiring.slice(0,5).map(({item,type})=><div key={item.id} style={{display:'flex',justifyContent:'space-between',gap:8,padding:'7px 0',borderTop:'1px solid #edf1f4',fontSize:12}}><span>{item.name}<small style={{display:'block',color:'#64748b'}}>{type === 'destaque' ? 'Destaque' : 'Parceiro'}</small></span><b>{new Date(item.plan_expires_at || item.featured_expires_at).toLocaleDateString('pt-BR')}</b></div>) : <small style={{color:'#64748b'}}>Nenhum plano vence nos próximos 7 dias.</small>}
            </div>
            <div style={{background:'#fff',border:'1px solid #e0e8ed',borderRadius:12,padding:12}}>
              <strong style={{display:'block',marginBottom:8}}>Planos vencidos</strong>
              {adminOverview.expiredItems.length ? adminOverview.expiredItems.slice(0,5).map(({item,type})=><div key={item.id} style={{display:'flex',justifyContent:'space-between',gap:8,padding:'7px 0',borderTop:'1px solid #edf1f4',fontSize:12}}><span>{item.name}<small style={{display:'block',color:'#64748b'}}>{type === 'destaque' ? 'Destaque' : 'Parceiro'}</small></span><b>{new Date(item.plan_expires_at || item.featured_expires_at).toLocaleDateString('pt-BR')}</b></div>) : <small style={{color:'#64748b'}}>Nenhum plano vencido identificado.</small>}
            </div>
          </div>
          <small style={{display:'block',marginTop:10,color:'#64748b'}}>Os planos são considerados ativos quando o negócio está aprovado e a data de vencimento ainda não passou. Os indicadores refletem os registros carregados pelo Supabase; os valores financeiros estimados ficam no relatório abaixo.</small>
        </section>
        <div className="admin-stats">
          <button type="button" className={`admin-stat-button ${adminFilter==='all'?'selected':''}`} onClick={()=>setAdminFilter('all')} aria-label="Mostrar todos os cadastros"><b>{adminBusinesses.length}</b><span>Cadastros</span></button>
          <button type="button" className={`admin-stat-button ${adminFilter==='pending'?'selected':''}`} onClick={()=>setAdminFilter('pending')} aria-label="Mostrar cadastros pendentes"><b>{adminBusinesses.filter(item=>item.status==='pending').length}</b><span>Pendentes</span></button>
          <button type="button" className={`admin-stat-button ${adminFilter==='approved'?'selected':''}`} onClick={()=>setAdminFilter('approved')} aria-label="Mostrar cadastros aprovados"><b>{adminBusinesses.filter(item=>item.status==='approved').length}</b><span>Aprovados</span></button>
          <button type="button" className={`admin-stat-button ${adminFilter==='featured'?'selected':''}`} onClick={()=>setAdminFilter('featured')} aria-label="Mostrar anúncios em destaque"><b>{adminBusinesses.filter(item=>item.featured).length}</b><span>Em destaque</span></button>
        </div>
        <div className="admin-filters">{[['pending','Pendentes'],['approved','Aprovados'],['rejected','Rejeitados'],['suspended','Suspensos'],['all','Todos']].map(([value,label])=><button key={value} type="button" className={adminFilter===value?'active':''} aria-pressed={adminFilter===value} onClick={()=>setAdminFilter(value)}>{label}</button>)}</div>
        <input type="search" maxLength="120" className="admin-search" value={adminSearch} onChange={e=>setAdminSearch(e.target.value)} placeholder="Buscar por negócio, cidade ou telefone..." aria-label="Buscar cadastros" />
        <div className="admin-search-summary" role="status" aria-live="polite" aria-atomic="true"><span>{filteredAdminBusinesses.length} {filteredAdminBusinesses.length === 1 ? "cadastro encontrado" : "cadastros encontrados"}</span>{(adminSearch.trim() || adminFilter !== "all") && <button type="button" onClick={()=>{setAdminSearch("");setAdminFilter("all")}}>Limpar busca e filtros</button>}</div>
        {adminError && <div className="form-error" role="alert">{adminError}</div>}
         {!planSchemaReady && <div className="form-notice" role="status"><strong>Controle de planos aguardando configuração.</strong><br/>Execute uma vez o arquivo <code>supabase/plans.sql</code> no SQL Editor do Supabase para habilitar ativação, vencimento e renovação.</div>}
        {editingBusiness && <form className="admin-edit-form" onSubmit={saveBusinessEdit}>
          <h3>Editar anúncio</h3>
          <label>Nome<input required maxLength="100" value={editingBusiness.name} onChange={e=>setEditingBusiness({...editingBusiness,name:e.target.value})}/></label>
          <label>Descrição<textarea rows="3" maxLength="600" value={editingBusiness.description || ''} onChange={e=>setEditingBusiness({...editingBusiness,description:e.target.value})}/><small className="character-count">{(editingBusiness.description || '').length}/600 caracteres</small></label>
          <div className="form-row"><label>Cidade<input maxLength="80" value={editingBusiness.city || ''} onChange={e=>setEditingBusiness({...editingBusiness,city:e.target.value})}/></label><label>UF<input maxLength="2" pattern="[A-Za-z]{2}" title="Informe a sigla com duas letras" value={editingBusiness.state || ''} onChange={e=>setEditingBusiness({...editingBusiness,state:e.target.value.toUpperCase()})}/></label></div>
          <label>Telefone / WhatsApp<input type="tel" inputMode="tel" autoComplete="tel" maxLength="20" value={editingBusiness.phone || ''} onChange={e=>setEditingBusiness({...editingBusiness,phone:e.target.value})}/></label>
          <LocationFields item={editingBusiness} onChange={patch=>setEditingBusiness({...editingBusiness,...patch})}/>
          <div className="admin-actions"><button type="submit" className="approve-action" disabled={formBusy}>Salvar alterações</button><button type="button" disabled={formBusy} onClick={()=>setEditingBusiness(null)}>Cancelar</button></div>
        </form>}
        {adminLoading ? <div className="empty-state">Carregando cadastros...</div> : <div className="admin-list">
          {filteredAdminBusinesses.length ? filteredAdminBusinesses.map(item=><article className="admin-business" key={item.id}>
            <div className="admin-business-head"><div><h3>{item.name}</h3><span>{item.business_type} · {[item.city,item.state].filter(Boolean).join('/')}</span></div><small className={'status-badge status-'+item.status}>{({pending:'Pendente',approved:'Aprovado',rejected:'Rejeitado',suspended:'Suspenso'})[item.status] || item.status}</small></div>
            <p>{item.description || 'Sem descrição informada.'}</p>
            {(item.logo_url || item.gallery_urls?.length) && <div className="admin-image-preview">{item.logo_url && <img loading="lazy" src={item.logo_url} alt={`Logo ${item.name}`}/>} {(item.gallery_urls || []).map((url,index)=><img key={url} loading="lazy" src={url} alt={`Foto ${index+1} de ${item.name}`}/>)}</div>}
            <div className="admin-meta"><span>{item.business_categories?.[0]?.categories?.name || 'Sem categoria'}</span>{item.phone && <span>{item.phone}</span>}<span>{new Date(item.created_at).toLocaleDateString('pt-BR')}</span></div>
            <div className="admin-meta" aria-label="Desempenho do anúncio"><span>👁 {Number(item.views_count || 0).toLocaleString('pt-BR')} visualizações</span><span>WhatsApp: {Number(item.whatsapp_clicks || 0).toLocaleString('pt-BR')} cliques</span></div>
             <div className="admin-plan-box" style={{margin:'12px 0',padding:12,border:'1px solid #dce6ec',borderRadius:12,background:'#f7fafc'}}>
               <div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                 <strong>Plano: {({gratuito:'Gratuito',destaque:'Destaque',parceiro:'Parceiro'})[item.plan_type] || (item.featured?'Destaque legado':'Gratuito')}</strong>
                 {item.plan_expires_at && <small>Vence em {new Date(item.plan_expires_at).toLocaleDateString('pt-BR')} {new Date(item.plan_expires_at).getTime() <= Date.now() ? '· VENCIDO' : ''}</small>}
               </div>
               {planSchemaReady && <div className="admin-actions" style={{marginTop:8}}>
                 <button type="button" disabled={formBusy} onClick={()=>setBusinessPlan(item,'destaque')}>{item.plan_type === 'destaque' ? 'Renovar Destaque · +30 dias' : 'Destaque · 30 dias'}</button>
                 <button type="button" disabled={formBusy} onClick={()=>setBusinessPlan(item,'parceiro')}>{item.plan_type === 'parceiro' ? 'Renovar Parceiro · +30 dias' : 'Parceiro · 30 dias'}</button>
                 <button type="button" disabled={formBusy} onClick={()=>setBusinessPlan(item,'gratuito')}>Remover plano</button>
               </div>}
               <small style={{display:'block',marginTop:6,color:'#64748b'}}>Ative somente depois de confirmar a contratação. O destaque vence automaticamente na vitrine.</small>
             </div>
            <div className="admin-actions">
              <button type="button" disabled={formBusy} onClick={()=>setEditingBusiness({...item})}>Editar anúncio</button>
              <button type="button" disabled={formBusy} className="delete-action" onClick={()=>deleteBusiness(item)}>Excluir definitivamente</button>
              <button type="button" disabled={formBusy} className={item.featured?'featured-action':''} onClick={()=>toggleFeatured(item)}>{item.featured?'Remover destaque':'Destacar anúncio'}</button><button type="button" disabled={formBusy} className={item.verified?'verified-action':''} onClick={()=>toggleVerified(item)}>{item.verified?'Remover selo verificado':'Marcar como verificado'}</button>
              {item.status!=='approved' && <button type="button" disabled={formBusy} className="approve-action" onClick={()=>moderateBusiness(item.id,'approved')}>Aprovar</button>}
              {item.status!=='rejected' && <button type="button" disabled={formBusy} onClick={()=>moderateBusiness(item.id,'rejected')}>Rejeitar</button>}
              {item.status!=='suspended' && item.status==='approved' && <button type="button" disabled={formBusy} onClick={()=>moderateBusiness(item.id,'suspended')}>Suspender</button>}
              {item.status!=='pending' && <button type="button" disabled={formBusy} onClick={()=>moderateBusiness(item.id,'pending')}>Voltar para análise</button>}
            </div>
          </article>) : <div className="admin-empty-state">
            <strong>{adminBusinesses.length ? 'Nenhum resultado encontrado' : 'Ainda não há anúncios cadastrados'}</strong>
            <p>{adminBusinesses.length ? 'Não encontramos cadastros com a busca e os filtros atuais. Limpe os filtros para ver a lista completa.' : 'Quando alguém enviar um cadastro de anunciante, ele aparecerá aqui para sua análise.'}</p>
            {(adminSearch.trim() || adminFilter !== 'all') && <button type="button" onClick={()=>{setAdminSearch('');setAdminFilter('all')}}>Limpar busca e filtros</button>}
          </div>}
        </div>}
        <section className="admin-category-manager"><h3>Gerenciar categorias</h3><p>Cadastre novas categorias ou desative as que não devem aparecer no formulário de anunciantes.</p>
          <form onSubmit={addAdminCategory}><input aria-label="Nome da nova categoria" maxLength="60" value={newCategory} onChange={e=>setNewCategory(e.target.value)} maxLength="60" placeholder="Nome da nova categoria" required/><button type="submit" className="approve-action" disabled={formBusy}>Adicionar</button></form>
          <div className="admin-category-list">{adminCategories.length ? adminCategories.map(cat=><div key={cat.id}><span>{cat.name}<small>{cat.active?'Ativa':'Inativa'}</small></span><button type="button" disabled={formBusy} onClick={()=>toggleCategory(cat)}>{cat.active?'Desativar':'Ativar'}</button></div>) : <div className="admin-inline-empty">Nenhuma categoria cadastrada ainda.</div>}</div>
        </section>
        <section className="admin-category-manager" style={{marginTop:18}}>
          <h3>Desempenho da vitrine</h3>
          <p>Indicadores aproximados dos anúncios aprovados. Visualizações contam aberturas do perfil; cliques contam acionamentos do botão de WhatsApp.</p>
          <div className="admin-stats" style={{margin:'12px 0'}}>
            <div className="admin-stat-button"><b>{adminOverview.views.toLocaleString('pt-BR')}</b><span>Visualizações acumuladas</span></div>
            <div className="admin-stat-button"><b>{adminOverview.whatsappClicks.toLocaleString('pt-BR')}</b><span>Cliques acumulados no WhatsApp</span></div>
          </div>
          <label style={{display:'block',maxWidth:240,margin:'12px 0'}}>Mês de referência<input type="month" value={selectedReportMonth} onChange={event=>setSelectedReportMonth(event.target.value)}/></label>
          {metricsLoading ? <div className="admin-inline-empty">Carregando desempenho do mês...</div> : metricsError ? <div className="form-notice" role="status">{metricsError}</div> : <div className="admin-stats" style={{margin:'12px 0'}}>
            <div className="admin-stat-button"><b>{monthlyBusinessMetrics.reduce((sum,row)=>sum+Number(row.views_count || 0),0).toLocaleString('pt-BR')}</b><span>Visualizações no mês</span></div>
            <div className="admin-stat-button"><b>{monthlyBusinessMetrics.reduce((sum,row)=>sum+Number(row.whatsapp_clicks || 0),0).toLocaleString('pt-BR')}</b><span>Cliques no WhatsApp no mês</span></div>
          </div>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12,marginTop:12}}>
            <div style={{background:'#fff',border:'1px solid #e0e8ed',borderRadius:12,padding:12}}>
              <strong style={{display:'block',marginBottom:8}}>Mais visualizados</strong>
              {adminOverview.topViewed.length ? adminOverview.topViewed.map(item=><div key={item.id} style={{display:'flex',justifyContent:'space-between',gap:8,padding:'7px 0',borderTop:'1px solid #edf1f4',fontSize:12}}><span>{item.name}</span><b>{Number(item.views_count || 0).toLocaleString('pt-BR')}</b></div>) : <small style={{color:'#64748b'}}>Ainda não há visualizações registradas.</small>}
            </div>
            <div style={{background:'#fff',border:'1px solid #e0e8ed',borderRadius:12,padding:12}}>
              <strong style={{display:'block',marginBottom:8}}>Mais contatos pelo WhatsApp</strong>
              {adminOverview.topContacted.length ? adminOverview.topContacted.map(item=><div key={item.id} style={{display:'flex',justifyContent:'space-between',gap:8,padding:'7px 0',borderTop:'1px solid #edf1f4',fontSize:12}}><span>{item.name}</span><b>{Number(item.whatsapp_clicks || 0).toLocaleString('pt-BR')}</b></div>) : <small style={{color:'#64748b'}}>Ainda não há cliques registrados.</small>}
            </div>
          </div>
          <small style={{display:'block',marginTop:10,color:'#64748b'}}>Os dados são aproximados e começam a compor o histórico mensal após a migração. Os totais acumulados já existentes são preservados; interações antigas não podem ser distribuídas retroativamente por mês.</small>
        </section>
        <section className="admin-category-manager" style={{marginTop:18}}>
          <h3>Relatório financeiro dos planos</h3>
          <p>Consulte as ativações registradas por mês e exporte os dados para arquivo.</p>
          <label style={{display:'block',maxWidth:240,margin:'12px 0'}}>Mês de referência<input type="month" value={selectedReportMonth} onChange={event=>setSelectedReportMonth(event.target.value)}/></label>
          <div className="admin-stats" style={{margin:'12px 0'}}>
            <div className="admin-stat-button"><b>R$ {financeSummary.total.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</b><span>Valor registrado no mês</span></div>
            <div className="admin-stat-button"><b>{financeSummary.count}</b><span>Ativações no mês</span></div>
            <div className="admin-stat-button"><b>{financeSummary.destaque}</b><span>Planos Destaque</span></div>
            <div className="admin-stat-button"><b>{financeSummary.parceiro}</b><span>Planos Parceiro</span></div>
          </div>
          <div className="admin-actions" style={{margin:'12px 0'}}>
            <button type="button" disabled={!reportRows.length} onClick={()=>exportPlanReport('pdf')}>Imprimir / salvar PDF</button>
            <button type="button" disabled={!reportRows.length} onClick={()=>exportPlanReport('csv')}>Exportar planilha Excel (CSV)</button>
            <button type="button" disabled={auditLoading} onClick={loadAdminAuditLogs}>Atualizar dados</button>
          </div>
          {reportRows.length ? <div className="audit-list">{reportRows.map(log=><article className="audit-item" key={log.id}>
            <div><b>{log.entity_name || 'Negócio'}</b><span>{log.planType === 'destaque' ? 'Plano Destaque' : 'Plano Parceiro'} · R$ {log.amount.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
            <small>{new Date(log.created_at).toLocaleDateString('pt-BR')}<br/>{log.actor_email || 'Administrador'}</small>
          </article>)}</div> : <div className="empty-state">Nenhuma ativação de plano registrada neste mês.</div>}
          <small style={{display:'block',marginTop:10,color:'#64748b'}}>O PDF é gerado pela opção de impressão do navegador. A planilha CSV abre no Excel. Os dados vêm das últimas 100 ações carregadas no histórico e usam os preços atuais (Destaque R$ 29,90 e Parceiro R$ 49,90); não representam confirmação bancária.</small>
        </section>
        <section className="admin-category-manager admin-audit"><h3>Histórico administrativo</h3><p>Últimas 100 ações realizadas no painel, com data e responsável.</p>
          {auditLoading ? <div className="empty-state">Carregando histórico...</div> : adminAuditLogs.length ? <div className="audit-list">{adminAuditLogs.map(log=><article className="audit-item" key={log.id}><div><b>{log.entity_name || log.entity_type}</b><span>{log.action} · {log.entity_type}</span></div><small>{log.actor_email || 'Administrador'}<br/>{new Date(log.created_at).toLocaleString('pt-BR')}</small></article>)}</div> : <div className="empty-state">Nenhuma ação registrada ainda.</div>}
          <button type="button" className="text-switch" disabled={auditLoading} onClick={loadAdminAuditLogs}>Atualizar histórico</button>
        </section>
        <button type="button" className="text-switch" onClick={async()=>{await supabase.auth.signOut();setAuthUser(null);setShowForm(false)}}>Sair da conta administrativa</button>
      </> : <>
      <div className="eyebrow dark">CADASTRO DE ANUNCIANTE</div>
      <h2>{authUser ? 'Apresente seu negócio.' : 'Entre para anunciar.'}</h2>
      {!isSupabaseConfigured ? <p>O cadastro está temporariamente indisponível. A conexão com o banco ainda não foi configurada na publicação.</p> : <>
        {formMessage && <div className="form-notice" role="status" aria-live="polite">{formMessage}</div>}
        {formError && <div className="form-error" role="alert">{formError}</div>}
        {passwordRecovery ? <form onSubmit={updateRecoveredPassword} className="business-form">
          <div className="eyebrow dark">RECUPERAÇÃO DE ACESSO</div><h2>Crie uma nova senha.</h2>
          <p>Escolha uma senha com pelo menos 6 caracteres.</p>
          {formMessage && <div className="form-notice" role="status" aria-live="polite">{formMessage}</div>}
          {formError && <div className="form-error" role="alert">{formError}</div>}
          <label>Nova senha<input type="password" required minLength="6" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Mínimo de 6 caracteres"/></label>
          <button type="submit" className="btn modal-submit" disabled={formBusy}>{formBusy ? 'Salvando...' : 'Salvar nova senha'}</button>
        </form> : !authUser ? forgotPasswordMode ? <>
          <p>Informe seu e-mail e enviaremos um link para você criar uma nova senha.</p>
          <form onSubmit={requestPasswordRecovery} className="business-form">
            <label>E-mail<input ref={authEmailInput} type="email" required autoComplete="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="voce@email.com"/></label>
            <button type="submit" className="btn modal-submit" disabled={formBusy}>{formBusy ? 'Enviando...' : 'Enviar link de recuperação'}</button>
          </form>
          <button type="button" className="text-switch" onClick={()=>{setForgotPasswordMode(false);setFormError('');setFormMessage('')}}>Voltar para entrar</button>
        </> : <>
          <p>{authMode === 'signup' ? 'Crie uma conta gratuita para cadastrar sua empresa ou serviço.' : 'Entre na sua conta para continuar.'}</p>
          <form onSubmit={handleAuthSubmit} className="business-form">
            <label>E-mail<input ref={authEmailInput} type="email" required autoComplete="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="voce@email.com"/></label>
            <label>Senha<input type="password" required minLength="6" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="Mínimo de 6 caracteres"/></label>
            <button type="submit" className="btn modal-submit" disabled={formBusy}>{formBusy ? 'Aguarde...' : authMode === 'signup' ? 'Criar conta' : 'Entrar'}</button>
          </form>
          <button type="button" className="text-switch" onClick={()=>{setAuthMode(authMode === 'signup' ? 'login' : 'signup');setFormError('');setFormMessage('')}}>{authMode === 'signup' ? 'Já tenho conta — entrar' : 'Não tenho conta — criar agora'}</button>
          {authMode === 'login' && <button type="button" className="text-switch" disabled={formBusy} onClick={openPasswordRecovery}>Esqueci minha senha</button>}
        </> : <>
          <section className="owner-dashboard">
            <div className="owner-dashboard-head"><div><div className="eyebrow dark">ÁREA DO ANUNCIANTE</div><h3>Meus anúncios</h3><p>Acompanhe a situação dos seus cadastros.</p></div><button type="button" className="owner-refresh" onClick={loadOwnerBusinesses} disabled={ownerLoading} aria-label="Atualizar meus anúncios">{ownerLoading ? "Atualizando..." : "Atualizar"}</button></div>
            <div className="owner-stats" aria-label="Filtrar meus anúncios">
              <button type="button" onClick={()=>setOwnerFilter('all')} aria-pressed={ownerFilter === 'all'}><b>{ownerStats.total}</b><span>Todos</span></button>
              <button type="button" onClick={()=>setOwnerFilter('pending')} aria-pressed={ownerFilter === 'pending'}><b>{ownerStats.pending}</b><span>Em análise</span></button>
              <button type="button" onClick={()=>setOwnerFilter('approved')} aria-pressed={ownerFilter === 'approved'}><b>{ownerStats.approved}</b><span>Aprovados</span></button>
              <button type="button" onClick={()=>setOwnerFilter('attention')} aria-pressed={ownerFilter === 'attention'}><b>{ownerStats.attention}</b><span>Precisam de atenção</span></button>
            </div>
            {ownerError && <div className="form-error" role="alert">{ownerError}</div>}
            {ownerShareMessage && <div className="form-message" role="status">{ownerShareMessage}</div>}
            {ownerBusinesses.length > 0 && <div className="owner-search"><label htmlFor="owner-business-search">Buscar nos meus anúncios</label><div><input id="owner-business-search" type="search" maxLength="100" value={ownerSearch} onChange={event=>setOwnerSearch(event.target.value)} placeholder="Nome, cidade ou descrição..." aria-label="Buscar nos meus anúncios"/>{ownerSearch && <button type="button" onClick={()=>setOwnerSearch('')} aria-label="Limpar busca dos meus anúncios">Limpar</button>}</div><small role="status" aria-live="polite">{filteredOwnerBusinesses.length} de {ownerBusinesses.length} anúncio(s)</small><label className="owner-sort-label">Ordenar por<select value={ownerSort} onChange={event=>setOwnerSort(event.target.value)} aria-label="Ordenar meus anúncios"><option value="newest">Mais recentes</option><option value="oldest">Mais antigos</option><option value="name">Nome (A–Z)</option></select></label></div>}
            {ownerLoading ? <div className="empty-state">Carregando seus anúncios...</div> : ownerBusinesses.length ? filteredOwnerBusinesses.length ? <div className="owner-list">{filteredOwnerBusinesses.map(item => <article className="owner-business" key={item.id}>
              <div className="owner-business-head"><div><b>{item.name}</b><small>{[item.city,item.state].filter(Boolean).join(' / ')} · {item.business_categories?.[0]?.categories?.name || 'Sem categoria'}</small></div><span className={'status-badge status-'+item.status}>{({pending:'Em análise',approved:'Aprovado',rejected:'Rejeitado',suspended:'Suspenso'})[item.status] || item.status}</span></div>
              <p>{item.description || 'Sem descrição informada.'}</p>
              {item.status === 'approved' && <div className="owner-metrics"><span><b>{Number(item.views_count || 0)}</b> visualizações</span><span><b>{Number(item.whatsapp_clicks || 0)}</b> contatos pelo WhatsApp</span></div>}
              <small className="owner-updated">Enviado em {new Date(item.created_at).toLocaleDateString('pt-BR')}{item.updated_at && item.updated_at !== item.created_at ? ` · Atualizado em ${new Date(item.updated_at).toLocaleDateString('pt-BR')}` : ''}</small>
              {['pending','approved'].includes(item.status) ? <><button type="button" className="owner-edit-button" onClick={() => setOwnerEditing({...item})}>Editar anúncio</button>{item.status === 'approved' && <><small className="owner-status-help">Ao salvar, o anúncio ficará em análise até a equipe aprovar as alterações.</small><button type="button" className="owner-share-link" onClick={() => copyOwnerBusinessLink(item)}>Copiar link público</button></>}</> : <small className="owner-status-help">{item.status === 'rejected' ? 'Entre em contato com a equipe para entender os ajustes necessários.' : 'Este anúncio não está visível na vitrine no momento.'}</small>}
            </article>)}</div> : <div className="empty-state">Nenhum anúncio nesta situação. Selecione outro filtro para consultar seus cadastros.</div> : <div className="empty-state">Você ainda não cadastrou nenhum negócio. Preencha o formulário abaixo para começar.</div>}
          </section>
          <section className="marketing-assistant">
            <div className="eyebrow dark">FERRAMENTA DE DIVULGAÇÃO</div>
            <h3>Assistente de divulgação</h3>
            <p>Crie uma sugestão de texto para apresentar seu negócio nas redes sociais e no WhatsApp. Funciona sem chave ou serviço externo.</p>
            {ownerBusinesses.length > 0 && <label>Qual negócio deseja divulgar?
              <select value={marketingBusinessId} onChange={e=>setMarketingBusinessId(e.target.value)}>
                <option value="">Selecionar primeiro anúncio</option>
                {ownerBusinesses.map(item => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
              </select>
            </label>}
            <label>Onde você vai publicar?
              <select value={marketingPlatform} onChange={e=>setMarketingPlatform(e.target.value)}>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="tiktok">TikTok</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </label>
            <label>Estilo do texto
              <select value={marketingTone} onChange={e=>setMarketingTone(e.target.value)}>
                <option value="profissional">Profissional</option>
                <option value="proximo">Próximo e acolhedor</option>
                <option value="direto">Direto e objetivo</option>
              </select>
            </label>
            <button type="button" className="btn modal-submit" onClick={generateMarketingCopy}> <Sparkles size={16}/> Gerar texto de divulgação</button>
            {marketingOutput && <div className="marketing-output">
              <label htmlFor="marketing-copy-result">Texto sugerido</label>
              <textarea id="marketing-copy-result" rows="7" readOnly value={marketingOutput}/>
              <button type="button" className="business-share-button" onClick={copyMarketingCopy}>{marketingCopied ? 'Texto copiado!' : 'Copiar texto'}</button>
              <small>Revise as informações antes de publicar. Esta versão usa modelos locais; não envia dados para serviços externos.</small>
            </div>}
          </section>
          {ownerEditing && <form className="owner-edit-form business-form" onSubmit={saveOwnerBusiness}>
            <h3>Editar meu anúncio</h3>
            <label>Nome do negócio<input required maxLength="100" autoComplete="organization" value={ownerEditing.name || ''} onChange={e=>setOwnerEditing({...ownerEditing,name:e.target.value})}/></label>
            <label>Tipo<select value={ownerEditing.business_type || 'empresa'} onChange={e=>setOwnerEditing({...ownerEditing,business_type:e.target.value})}><option value="empresa">Empresa</option><option value="profissional">Profissional</option><option value="loja">Loja / comércio</option><option value="servico">Prestador de serviço</option></select></label>
            <label>Descrição<textarea rows="3" maxLength="600" value={ownerEditing.description || ''} onChange={e=>setOwnerEditing({...ownerEditing,description:e.target.value})}/><small className="character-count">{(ownerEditing.description || '').length}/600 caracteres</small></label>
            <div className="form-row"><label>Cidade<input required maxLength="80" autoComplete="address-level2" value={ownerEditing.city || ''} onChange={e=>setOwnerEditing({...ownerEditing,city:e.target.value})}/></label><label>Estado (UF)<input required maxLength="2" pattern="[A-Za-z]{2}" title="Informe a sigla com duas letras" value={ownerEditing.state || ''} onChange={e=>setOwnerEditing({...ownerEditing,state:e.target.value.toUpperCase()})}/></label></div>
            <label>Telefone / WhatsApp<input type="tel" inputMode="tel" autoComplete="tel" maxLength="20" value={ownerEditing.phone || ''} onChange={e=>setOwnerEditing({...ownerEditing,phone:e.target.value})}/></label>
            <LocationFields item={ownerEditing} onChange={patch=>setOwnerEditing({...ownerEditing,...patch})}/>
            <div className="admin-actions"><button type="submit" className="btn modal-submit" disabled={formBusy}>{formBusy ? 'Salvando...' : 'Salvar alterações'}</button><button type="button" disabled={formBusy} onClick={()=>setOwnerEditing(null)}>Cancelar</button></div>
          </form>}
          <div className="owner-new-listing"><h3>Cadastrar outro negócio</h3><p>Seu novo anúncio ficará pendente até a aprovação da equipe.</p></div>
          <form onSubmit={handleBusinessSubmit} className="business-form">
            <label>Nome do negócio<input required maxLength="100" value={businessForm.name} onChange={e=>setBusinessForm({...businessForm,name:e.target.value})}/></label>
            <label>Tipo<select value={businessForm.business_type} onChange={e=>setBusinessForm({...businessForm,business_type:e.target.value})}><option value="empresa">Empresa</option><option value="profissional">Profissional</option><option value="loja">Loja / comércio</option><option value="servico">Prestador de serviço</option></select></label>
            <label>Descrição<textarea rows="3" maxLength="600" value={businessForm.description} onChange={e=>setBusinessForm({...businessForm,description:e.target.value})} placeholder="Conte brevemente o que você oferece."/><small className="character-count">{businessForm.description.length}/600 caracteres</small></label>
            <label>Categoria<select value={businessForm.category_id} onChange={e=>setBusinessForm({...businessForm,category_id:e.target.value})}><option value="">Selecione uma categoria</option>{availableCategories.map(cat=><option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label>
            <div className="form-row"><label>Cidade<input required maxLength="80" autoComplete="address-level2" value={businessForm.city} onChange={e=>setBusinessForm({...businessForm,city:e.target.value})}/></label><label>Estado (UF)<input required maxLength="2" pattern="[A-Za-z]{2}" title="Informe a sigla com duas letras" value={businessForm.state} onChange={e=>setBusinessForm({...businessForm,state:e.target.value.toUpperCase()})}/></label></div>
            <LocationFields item={businessForm} onChange={patch=>setBusinessForm({...businessForm,...patch})}/>
            <label>Telefone / WhatsApp<input type="tel" inputMode="tel" autoComplete="tel" maxLength="20" value={businessForm.phone} onChange={e=>setBusinessForm({...businessForm,phone:e.target.value})}/></label>
            <label>Logo da empresa<input id="business-logo-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-describedby="business-logo-help" onChange={handleLogoSelection}/><small className="upload-help" id="business-logo-help">Formatos JPG, PNG, WEBP ou GIF. Uma imagem, até 5 MB.</small></label>{logoPreviewUrl && <div className="upload-preview"><span>Prévia da logo</span><img src={logoPreviewUrl} alt="Prévia da logo selecionada"/></div>}
            <label>Fotos do negócio (até 5)<input id="business-gallery-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple aria-describedby="business-gallery-help" onChange={handleGallerySelection}/><small className="upload-help" id="business-gallery-help">Formatos JPG, PNG, WEBP ou GIF. Selecione até 5 fotos, cada uma com no máximo 5 MB.</small></label>
            {galleryFiles.length > 0 && <div className="selected-files" role="status" aria-live="polite"><strong>{galleryFiles.length} {galleryFiles.length === 1 ? "foto selecionada" : "fotos selecionadas"}:</strong>{galleryFiles.map((file,index)=><span key={`${file.name}-${index}`}>{file.name}</span>)}</div>}{galleryPreviewUrls.length > 0 && <div className="upload-gallery-preview" aria-label="Prévia das fotos selecionadas">{galleryPreviewUrls.map((item,index)=><figure key={item.url}><img src={item.url} alt={`Prévia da foto ${index+1}: ${item.name}`}/><figcaption>{index+1}</figcaption></figure>)}</div>}
            <button type="submit" className="btn modal-submit" disabled={formBusy}>{formBusy ? 'Enviando...' : 'Enviar para aprovação'}</button>
          </form>
          <button type="button" className="text-switch" onClick={async()=>{await supabase.auth.signOut();setAuthUser(null);setFormMessage('')}}>Sair da conta</button>
        </>}
      </>}
      </>}
    </div></div>}
  </div>;
}
// Restaura rotas profundas após o fallback 404 do GitHub Pages.
const fallbackRoute = new URLSearchParams(window.location.search).get('__route');
if (fallbackRoute) {
  const restoredUrl = new URL(fallbackRoute, `${window.location.origin}${import.meta.env.BASE_URL}`);
  window.history.replaceState(null, '', `${restoredUrl.pathname}${restoredUrl.search}${restoredUrl.hash}`);
}

// Mantém o endereço antigo funcionando e encaminha a entrada principal para /br.
const basePath = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
if (window.location.pathname === basePath || window.location.pathname === basePath.slice(0, -1)) {
  window.history.replaceState(null, '', `${getMarketPath('BR')}${window.location.search}${window.location.hash}`);
}

function MarketApp() {
  const market = getMarketFromPath();
  if (!market.enabled) {
    return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:'24px',background:'#0b1730',color:'#fff',fontFamily:'DM Sans, sans-serif'}}>
      <section style={{width:'min(100%,520px)',padding:'36px',border:'1px solid #29415f',borderRadius:'20px',background:'#10233e',textAlign:'center'}}>
        <div style={{fontSize:'42px',marginBottom:'12px'}}>🇵🇾</div>
        <p style={{color:'#53d6b0',fontWeight:800,letterSpacing:'2px',fontSize:'11px'}}>CONECTA PARAGUAY</p>
        <h1 style={{fontSize:'30px',margin:'12px 0'}}>Estamos preparando este ambiente</h1>
        <p style={{color:'#b5c2d4',lineHeight:1.7,fontSize:'14px'}}>A versão paraguaia será liberada depois da conclusão dos testes de segurança, idioma, moeda e separação dos anúncios.</p>
        <a href={getMarketPath('BR')} style={{display:'inline-block',marginTop:'14px',padding:'12px 18px',borderRadius:'9px',background:'#53d6b0',color:'#082238',fontWeight:800,textDecoration:'none'}}>Ir para ConectaBrasil</a>
      </section>
    </main>;
  }
  return <App market={market} />;
}

createRoot(document.getElementById('root')).render(<MarketApp/>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(error => console.warn('Não foi possível ativar o modo de instalação/offline:', error));
  }, { once: true });
}