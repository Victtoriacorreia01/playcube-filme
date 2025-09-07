const API = 'https://api.themoviedb.org/3';
const LANG = 'pt-BR';
const REGION = 'BR';

function buildHeaders() {
  const h = { accept: 'application/json' };
  if (window.TMDB_ACCESS_TOKEN && window.TMDB_ACCESS_TOKEN !== '6202a79d7ce760a897c1c3ff77ecd25c') {
    h.Authorization = `Bearer ${window.TMDB_ACCESS_TOKEN}`;
  }
  return h;
}

async function api(path, params = {}) {
  const url = new URL(API + path);
  url.searchParams.set('language', LANG);
  url.searchParams.set('region', REGION);
  if (!buildHeaders().Authorization && window.TMDB_API_KEY) {
    url.searchParams.set('api_key', window.TMDB_API_KEY);
  }
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: buildHeaders() });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${t}`);
  }
  return res.json();
}

const $ = (s) => document.querySelector(s);
const byId = (id) => document.getElementById(id);

const IMG_BASE = 'https://image.tmdb.org/t/p/';
const SIZE = { poster: 'w342', profile: 'w185', backdrop: 'w780', bigPoster: 'w500' };
const img = (p, kind = 'poster') => (p ? `${IMG_BASE}${SIZE[kind] || SIZE.poster}${p}` : '');

const money = (n) => (typeof n === 'number' ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '—');
const dateBR = (s) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');
const languageName = (code) => {
  try {
    return new Intl.DisplayNames(['pt-BR'], { type: 'language' }).of((code || '').toLowerCase()) || code || '—';
  } catch {
    return code || '—';
  }
};
function live(msg) {
  const el = byId('live');
  el.textContent = msg;
}

async function renderDetails(movieId) {
  const d = await api(`/movie/${movieId}`);
  byId('poster').src = img(d.poster_path, 'bigPoster');
  byId('poster').alt = `Pôster de ${d.title}`;
  const year = d.release_date ? new Date(d.release_date).getFullYear() : '';
  byId('titulo').innerHTML = `${d.title} ${year ? `<span class="title-year">(${year})</span>` : ''}`;
  byId('generos').textContent = (d.genres || []).map((g) => g.name).join(', ') || '—';
  byId('sinopse').textContent = d.overview || 'Sem sinopse.';
  byId('situacao').textContent = d.status || '—';
  byId('idioma').textContent = languageName(d.original_language);
  byId('orcamento').textContent = money(d.budget);
  byId('receita').textContent = money(d.revenue);

  const credits = await api(`/movie/${movieId}/credits`);
  const crew = credits.crew || [];
  const directors = crew.filter((c) => c.job === 'Director').map((c) => c.name).slice(0, 3).join(', ') || '—';
  const writers = Array.from(
    new Set(crew.filter((c) => ['Writer', 'Screenplay', 'Story'].includes(c.job)).map((c) => c.name))
  )
    .slice(0, 4)
    .join(', ') || '—';
  byId('dirigido').textContent = directors;
  byId('escrito').textContent = writers;
}

async function renderCast(movieId) {
  const data = await api(`/movie/${movieId}/credits`);
  const list = (data.cast || []).slice(0, 10);
  const c = byId('elenco');
  c.innerHTML = '';
  list.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'cast-card';
    item.innerHTML = `
      <img class="cast-photo" src="${img(p.profile_path, 'profile')}" alt="Foto de ${p.name || 'Ator'}" loading="lazy">
      <div class="mt-2">
        <div class="font-weight-bold">${p.name || ''}</div>
        <div class="text-muted small">${p.character || ''}</div>
      </div>`;
    c.appendChild(item);
  });
}

async function renderReviews(movieId) {
  const data = await api(`/movie/${movieId}/reviews`, { page: 1 });
  const list = (data.results || []).slice(0, 2);
  const c = document.getElementById('reviews');
  c.innerHTML = '';
  list.forEach((r) => {
    const el = document.createElement('article');
    el.className = 'review-card';
    const rating = r.author_details && r.author_details.rating != null ? r.author_details.rating : '—';
    const content = (r.content || '').trim();
    const preview = content.length > 430 ? content.slice(0, 430) + '…' : content;
    el.innerHTML = `
      <p class="review-text">${preview.replace(/\n/g, '<br>')}</p>
      <div class="review-footer d-flex align-items-end justify-content-between">
        <div>
          <div class="by">por <a class="by-link" href="#" tabindex="-1">${r.author || 'Usuário'}</a></div>
          <div class="date">${dateBR(r.created_at)}</div>
        </div>
        <div class="score">Nota: <strong>${rating}</strong>/10</div>
      </div>`;
    c.appendChild(el);
  });
}

async function renderMedia(movieId) {
  const vids = await api(`/movie/${movieId}/videos`);
  let vlist = (vids.results || [])
    .filter((v) => v.site === 'YouTube')
    .sort((a, b) => (b.type === 'Trailer') - (a.type === 'Trailer'))
    .slice(0, 3);

  byId('count-videos').textContent = `(${(vids.results || []).length})`;
  const vwrap = byId('videos');
  vwrap.innerHTML = '';

  vlist.forEach((v) => {
    const thumb = `https://img.youtube.com/vi/${v.key}/hqdefault.jpg`;
    const card = document.createElement('div');
    card.className = 'video-card';
    card.style.backgroundImage = `url(${thumb})`;
    card.setAttribute('aria-label', v.name);
    card.setAttribute('role', 'button');
    card.tabIndex = 0;

    const play = () => {
      const holder = document.createElement('div');
      holder.className = 'thumb-video';
      holder.innerHTML = `
        <iframe title="${v.name}"
          src="https://www.youtube.com/embed/${v.key}?autoplay=1"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen></iframe>`;
      card.replaceWith(holder);
    };

    card.addEventListener('click', play);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        play();
      }
    });

    vwrap.appendChild(card);
  });

  const imgs = await api(`/movie/${movieId}/images`, { include_image_language: 'en,null,pt' });
  const posters = imgs.posters || [];
  const backdrops = imgs.backdrops || [];

  byId('count-posters').textContent = `(${posters.length})`;
  const pwrap = byId('posters');
  pwrap.innerHTML = '';
  posters.slice(0, 4).forEach((p) => {
    const d = document.createElement('div');
    d.className = 'media-img poster';
    d.innerHTML = `<img src="${img(p.file_path, 'bigPoster')}" loading="lazy" alt="Pôster">`;
    pwrap.appendChild(d);
  });

  byId('count-backdrops').textContent = `(${backdrops.length})`;
  const bwrap = byId('backdrops');
  bwrap.innerHTML = '';
  backdrops.slice(0, 2).forEach((b) => {
    const d = document.createElement('div');
    d.className = 'media-img backdrop';
    d.innerHTML = `<img src="${img(b.file_path, 'backdrop')}" loading="lazy" alt="Imagem de fundo">`;
    bwrap.appendChild(d);
  });
}

async function renderRecommendations(movieId) {
  const data = await api(`/movie/${movieId}/recommendations`, { page: 1 });
  const list = (data.results || []).slice(0, 6);
  const c = byId('recom');
  c.innerHTML = '';
  list.forEach((m) => {
    const card = document.createElement('div');
    card.className = 'recom-card';
    const pct = m.vote_average ? Math.round(m.vote_average * 10) + '%' : '';
    card.innerHTML = `
      <img src="${img(m.poster_path, 'poster')}" loading="lazy" alt="Pôster de ${m.title}">
      <div class="t">${m.title}</div>
      <div class="p">${pct}</div>`;
    c.appendChild(card);
  });
}

function getMovieIdFromURL() {
  const u = new URL(window.location.href);
  return u.searchParams.get('id');
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const movieId = getMovieIdFromURL() || '346698';
    live('Carregando informações do filme...');
    await renderDetails(movieId);
    await renderCast(movieId);
    await renderReviews(movieId);
    await renderMedia(movieId);
    await renderRecommendations(movieId);
    live('Filme carregado com sucesso!');
  } catch (e) {
    console.error(e);
    live('Falha ao carregar dados. Verifique sua chave TMDB.');
    alert('Erro: ' + e.message);
  }
});

