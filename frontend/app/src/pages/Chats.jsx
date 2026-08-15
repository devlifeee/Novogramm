import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../static/css/home.css';
import '../../static/css/chats.css';
import { apiUrl } from '../utils/api';

const token = () => localStorage.getItem('authToken') || '';

const Chats = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const api = async (url, options = {}) => {
    const response = await fetch(apiUrl(url), { ...options, headers: { Authorization: `Bearer ${token()}`, ...(options.headers || {}) } });
    const data = await response.json();
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      navigate('/login', { replace: true });
      throw new Error('Требуется вход');
    }
    if (!response.ok || !data.success) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || 'Ошибка запроса');
    return data;
  };

  const loadConversations = async () => {
    try { setConversations((await api('/api/conversations')).items || []); } catch (e) { setError(e.message); }
  };

  const openConversation = async (id) => {
    setActive(id); setError('');
    try { setMessages((await api(`/api/conversations/${id}/messages`)).items || []); } catch (e) { setError(e.message); }
  };

  const send = async (event) => {
    event.preventDefault();
    if (!active || !draft.trim()) return;
    try {
      const data = await api(`/api/conversations/${active}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: draft.trim() }) });
      setMessages((items) => [...items, data.message]); setDraft(''); await loadConversations();
    } catch (e) { setError(e.message); }
  };

  useEffect(() => { void loadConversations(); }, []);

  return <div className="home-page">
    <header className="home-header"><Link className="home-brand" to="/home"><span className="home-brand__name">Novogramm</span></Link><Link className="home-button home-button--ghost" to="/home">На главную</Link></header>
    <main className="chats-layout">
      <section className="home-sidebar chats-list"><h2>Диалоги</h2>{conversations.length === 0 && <p>Пока нет диалогов. Откройте профиль пользователя в поиске, чтобы начать общение.</p>}{conversations.map((item) => <button className={`home-nav__item chats-conversation ${active === item.id ? 'active' : ''}`} key={item.id} type="button" onClick={() => openConversation(item.id)}><span>Диалог #{item.id}</span><small>{item.last_message || 'Нет сообщений'}</small></button>)}</section>
      <section className="chats-panel"><div className="home-hero-card"><h1>Чаты</h1></div>{error && <div className="home-message home-message--error">{error}</div>}<div className="posts-feed chats-messages">{!active && <div className="home-state">Выберите диалог</div>}{messages.map((message) => <article className="post-card chats-message" key={message.id}><strong>{message.sender_name || `Пользователь #${message.sender_id}`}</strong><p>{message.content}</p></article>)}</div>{active && <form className="create-post chats-compose" onSubmit={send}><textarea className="create-post__input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={4000} placeholder="Сообщение"/><button className="home-button home-button--primary" disabled={!draft.trim()}>Отправить</button></form>}</section>
    </main>
  </div>;
};

export default Chats;
