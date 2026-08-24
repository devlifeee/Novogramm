import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../static/css/home.css';
import { apiUrl, mediaUrl } from '../utils/api';

const DEFAULT_AVATAR = '/static/images/default-avatar.png';

const getAuthToken = () => localStorage.getItem('authToken') || '';

const formatPostTime = (value) => {
  if (!value) return 'только что';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'только что';

  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMinutes < 1) return 'только что';
  if (diffMinutes < 60) return `${diffMinutes} мин назад`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} д назад`;

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

const postImageSrc = (post) => {
  if (post.image_data) return `data:image/jpeg;base64,${post.image_data}`;
  if (post.image_data_base64) return `data:image/jpeg;base64,${post.image_data_base64}`;
  return mediaUrl(post.image_path || '');
};

const avatarSrc = (avatar) => mediaUrl(avatar || DEFAULT_AVATAR);

const UserAvatar = ({ src, alt, className, hasClownHat = false }) => (
  <span className="user-avatar">
    <img className={className} src={src} alt={alt} />
    {hasClownHat && <span className="user-avatar__clown-hat" role="img" aria-label="Клоунская шляпа">🤡</span>}
  </span>
);

const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState(null);
  const [postImagePreview, setPostImagePreview] = useState('');
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [posting, setPosting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [profilePosts, setProfilePosts] = useState([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [moderatingPostId, setModeratingPostId] = useState(null);
  const [moderatingCommentId, setModeratingCommentId] = useState(null);
  const [banningUser, setBanningUser] = useState(false);
  const [updatingClownHat, setUpdatingClownHat] = useState(false);
  const [openModerationMenu, setOpenModerationMenu] = useState(null);
  const [error, setError] = useState('');

  const authToken = getAuthToken();
  const currentAvatar = avatarSrc(user?.avatar);

  const authorizedFetch = (url, options = {}) =>
    fetch(apiUrl(url), {
      ...options,
      headers: {
        Authorization: authToken,
        ...(options.headers || {})
      }
    });

  const loadUser = async () => {
    const response = await authorizedFetch('/api/get_user_data');
    const data = await response.json();

    if (!response.ok || !data.success) {
      localStorage.removeItem('authToken');
      navigate('/login', { replace: true });
      return;
    }

    setUser(data.user);
    localStorage.setItem('userId', String(data.user.id));
    localStorage.setItem('userName', data.user.name || '');
    localStorage.setItem('userUsername', data.user.username || '');
    localStorage.setItem('userAvatar', data.user.avatar || '');
  };

  const loadPosts = async () => {
    setLoadingPosts(true);
    setError('');

    try {
      const response = await authorizedFetch('/get_posts');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Не удалось загрузить посты');
      }

      setPosts(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError('Не удалось загрузить ленту постов.');
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (!authToken) {
      navigate('/login', { replace: true });
      return;
    }

    void loadUser();
    void loadPosts();
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();

    if (!authToken || query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setShowSearch(true);

      try {
        const response = await authorizedFetch(`/api/search_users?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Не удалось выполнить поиск');
        }

        setSearchResults(Array.isArray(data.users) ? data.users : []);
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setSearchResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 260);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!openModerationMenu) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-moderation-menu]')) {
        setOpenModerationMenu(null);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpenModerationMenu(null);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openModerationMenu]);

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPostImage(file);
    setPostImagePreview(URL.createObjectURL(file));
  };

  const handleCreatePost = async (event) => {
    event.preventDefault();

    if (!postContent.trim()) {
      setError('Напишите текст поста.');
      return;
    }

    setPosting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('content', postContent.trim());
      if (postImage) formData.append('image', postImage);

      const response = await authorizedFetch('/create_post', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Не удалось создать пост');
      }

      setPostContent('');
      setPostImage(null);
      setPostImagePreview('');
      await loadPosts();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось создать пост.');
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const response = await authorizedFetch(`/api/like_post/${postId}`, { method: 'POST' });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Не удалось обновить лайк');
      }

      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId
            ? { ...post, is_liked: data.action === 'like', likes_count: data.likes_count }
            : post
        )
      );
    } catch (requestError) {
      setError('Не удалось обновить лайк.');
    }
  };

  const handleModeratePost = async (postId) => {
    if (!window.confirm('Удалить этот пост за нарушение правил?')) return;

    setModeratingPostId(postId);
    setError('');
    try {
      const response = await authorizedFetch(`/api/posts/${postId}/moderate`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        const message = typeof data.error === 'string' ? data.error : data.error?.message;
        throw new Error(message || 'Не удалось удалить пост');
      }

      setPosts((current) => current.filter((post) => post.id !== postId));
      setProfilePosts((current) => current.filter((post) => post.id !== postId));
      setCommentsByPost((current) => {
        const { [postId]: _removed, ...remaining } = current;
        return remaining;
      });
      setOpenModerationMenu(null);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось удалить пост.');
    } finally {
      setModeratingPostId(null);
    }
  };

  const toggleModerationMenu = (menuId, event) => {
    event.stopPropagation();
    setOpenModerationMenu((current) => (current === menuId ? null : menuId));
  };

  const handleModerationDelete = (postId, event) => {
    event.stopPropagation();
    void handleModeratePost(postId);
  };

  const handleModerateComment = async (postId, commentId) => {
    if (!window.confirm('Удалить этот комментарий за нарушение правил?')) return;

    setModeratingCommentId(commentId);
    setError('');
    try {
      const response = await authorizedFetch(`/api/comments/${commentId}/moderate`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        const message = typeof data.error === 'string' ? data.error : data.error?.message;
        throw new Error(message || 'Не удалось удалить комментарий');
      }

      setCommentsByPost((current) => ({
        ...current,
        [postId]: (current[postId] || []).filter((comment) => comment.id !== commentId)
      }));
      setPosts((current) =>
        current.map((post) =>
          post.id === postId ? { ...post, comments_count: Math.max(0, (post.comments_count || 0) - 1) } : post
        )
      );
      setOpenModerationMenu(null);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось удалить комментарий.');
    } finally {
      setModeratingCommentId(null);
    }
  };

  const loadComments = async (postId) => {
    const response = await authorizedFetch(`/api/get_comments/${postId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Не удалось загрузить комментарии');
    }

    setCommentsByPost((current) => ({
      ...current,
      [postId]: Array.isArray(data) ? data : []
    }));
  };

  const toggleComments = async (postId) => {
    const nextValue = !openComments[postId];
    setOpenComments((current) => ({ ...current, [postId]: nextValue }));

    if (nextValue && !commentsByPost[postId]) {
      try {
        await loadComments(postId);
      } catch (requestError) {
        setError('Не удалось загрузить комментарии.');
      }
    }
  };

  const handleCommentSubmit = async (postId) => {
    const content = (commentDrafts[postId] || '').trim();
    if (!content) return;

    try {
      const response = await authorizedFetch(`/api/comment_post/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Не удалось добавить комментарий');
      }

      setOpenComments((current) => ({ ...current, [postId]: true }));
      setCommentDrafts((current) => ({ ...current, [postId]: '' }));
      setCommentsByPost((current) => ({
        ...current,
        [postId]: [...(current[postId] || []), data]
      }));
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId ? { ...post, comments_count: (post.comments_count || 0) + 1 } : post
        )
      );
    } catch (requestError) {
      setError('Не удалось добавить комментарий.');
    }
  };

  const handleFollow = async (targetUserId) => {
    try {
      const response = await authorizedFetch(`/api/follow/${targetUserId}`, { method: 'POST' });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Не удалось обновить подписку');
      }

      const isFollowing = data.action === 'follow';
      const updateUser = (person) =>
        person.id === targetUserId
          ? {
              ...person,
              is_following: isFollowing,
              followers_count: data.followers_count ?? person.followers_count
            }
          : person;

      setSearchResults((current) => current.map(updateUser));
      setProfileUser((current) => (current ? updateUser(current) : current));
    } catch (requestError) {
      setError(requestError.message || 'Не удалось обновить подписку.');
    }
  };

  const handleUserBan = async () => {
    if (!profileUser) return;

    const isBanned = Boolean(profileUser.is_banned);
    const confirmation = isBanned
      ? 'Разблокировать этого пользователя?'
      : 'Заблокировать этого пользователя? Он сразу потеряет доступ к аккаунту.';
    if (!window.confirm(confirmation)) return;

    setBanningUser(true);
    setError('');
    try {
      const response = await authorizedFetch(`/api/users/${profileUser.id}/ban`, {
        method: isBanned ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: isBanned ? undefined : JSON.stringify({})
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Не удалось изменить блокировку пользователя');
      }

      setProfileUser((current) => (current ? { ...current, is_banned: data.is_banned } : current));
    } catch (requestError) {
      setError(requestError.message || 'Не удалось изменить блокировку пользователя.');
    } finally {
      setBanningUser(false);
    }
  };

  const handleClownHat = async () => {
    if (!profileUser) return;

    const hasClownHat = Boolean(profileUser.has_clown_hat);
    const confirmation = hasClownHat
      ? 'Снять клоунскую шляпу с этого пользователя?'
      : 'Выдать этому пользователю клоунскую шляпу?';
    if (!window.confirm(confirmation)) return;

    setUpdatingClownHat(true);
    setError('');
    try {
      const response = await authorizedFetch(`/api/users/${profileUser.id}/clown-hat`, {
        method: hasClownHat ? 'DELETE' : 'POST'
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Не удалось изменить клоунскую шляпу');
      }

      setProfileUser((current) => (current ? { ...current, has_clown_hat: data.has_clown_hat } : current));
      setSearchResults((current) => current.map((person) => (
        person.id === profileUser.id ? { ...person, has_clown_hat: data.has_clown_hat } : person
      )));
      setPosts((current) => current.map((post) => (
        post.user_id === profileUser.id ? { ...post, user_has_clown_hat: data.has_clown_hat } : post
      )));
      setCommentsByPost((current) => Object.fromEntries(Object.entries(current).map(([postId, comments]) => [
        postId,
        comments.map((comment) => (
          comment.user_id === profileUser.id ? { ...comment, user_has_clown_hat: data.has_clown_hat } : comment
        ))
      ])));
    } catch (requestError) {
      setError(requestError.message || 'Не удалось изменить клоунскую шляпу.');
    } finally {
      setUpdatingClownHat(false);
    }
  };

  const openUserProfile = async (targetUserId) => {
    setProfileLoading(true);
    setShowSearch(false);
    setProfileUser(null);
    setProfilePosts([]);
    setError('');

    try {
      const [profileResponse, postsResponse] = await Promise.all([
        authorizedFetch(`/api/get_user/${targetUserId}`),
        authorizedFetch(`/api/get_user_posts/${targetUserId}`)
      ]);
      const profileData = await profileResponse.json();
      const postsData = await postsResponse.json();

      if (!profileResponse.ok || !profileData.success) {
        throw new Error(profileData.error || 'Не удалось открыть профиль');
      }

      if (!postsResponse.ok) {
        throw new Error(postsData.error || 'Не удалось загрузить посты профиля');
      }

      setProfileUser(profileData.user);
      setProfilePosts(Array.isArray(postsData) ? postsData : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось открыть профиль.');
      setProfileUser(null);
      setProfilePosts([]);
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfile = () => {
    setProfileUser(null);
    setProfilePosts([]);
  };

  const startConversation = async (recipientId) => {
    try {
      const response = await authorizedFetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: recipientId })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Не удалось открыть диалог');
    } catch (requestError) {
      setError(typeof requestError.message === 'string' ? requestError.message : 'Не удалось открыть диалог');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authEmail');
    navigate('/login', { replace: true });
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <Link className="home-brand" to="/home" aria-label="Novogramm">
          <span className="home-brand__mark">
            <img src="/static/images/logo.png" alt="Novogramm" />
          </span>
          <span className="home-brand__name">Novogramm</span>
        </Link>

        <div className="home-header__center home-search" aria-label="Поиск">
          <i className="fas fa-search" />
          <input
            className="home-search__input"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => setShowSearch(searchQuery.trim().length >= 2)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setShowSearch(false);
            }}
            placeholder="Поиск людей в Novogramm"
          />

          {showSearch && searchQuery.trim().length >= 2 && (
            <div className="home-search__results">
              {searching && <div className="home-search__empty">Ищем людей...</div>}

              {!searching && searchResults.length === 0 && (
                <div className="home-search__empty">Никого не нашли</div>
              )}

              {!searching &&
                searchResults.map((person) => (
                  <div className="home-search__result" key={person.id}>
                    <button
                      className="home-search__person"
                      type="button"
                      onClick={() => openUserProfile(person.id)}
                    >
                      <UserAvatar src={avatarSrc(person.avatar)} alt="Аватар" hasClownHat={person.has_clown_hat} />
                      <span className="home-search__person-content">
                        <strong>{person.name}</strong>
                        <small>@{person.username}</small>
                      </span>
                    </button>
                    <button
                      className={`home-mini-button ${person.is_following ? 'is-active' : ''}`}
                      type="button"
                      onClick={() => handleFollow(person.id)}
                    >
                      {person.is_following ? 'Вы подписаны' : 'Подписаться'}
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="home-header__actions">
          <button className="home-profile-chip" type="button" onClick={() => navigate('/settings')}>
            <UserAvatar src={currentAvatar} alt="Аватар" hasClownHat={user?.has_clown_hat} />
            <span className="home-profile-chip__name">{user?.name || 'Профиль'}</span>
          </button>
        </div>
      </header>

      <div className="home-layout">
        <aside className="home-sidebar" aria-label="Навигация">
          <nav className="home-nav">
            <Link to="/home" className="home-nav__item active">
              <i className="fas fa-home" />
              <span>Главная</span>
            </Link>
            <Link to="/settings" className="home-nav__item">
              <i className="fas fa-cog" />
              <span>Настройки</span>
            </Link>
          </nav>

          <button className="home-user-card" type="button" onClick={() => navigate('/settings')}>
            <UserAvatar className="home-user-card__avatar" src={currentAvatar} alt="Аватар" hasClownHat={user?.has_clown_hat} />
            <span className="home-user-card__content">
              <strong>{user?.name || 'Профиль'}</strong>
              <small>@{user?.username || 'username'}</small>
            </span>
          </button>
        </aside>

        <main className="home-feed">
          <section className="home-hero-card">
            <div>
              <p className="home-kicker">Лента обновлений</p>
              <h1>Главная</h1>
              <span>Публикуйте идеи, собирайте реакции и обсуждайте проекты в одном месте.</span>
            </div>
            <button className="home-icon-button home-hero-card__refresh" type="button" onClick={loadPosts}>
              <i className={`fas fa-sync-alt ${loadingPosts ? 'fa-spin' : ''}`} />
            </button>
          </section>

          <form className="create-post" onSubmit={handleCreatePost}>
            <div className="create-post__top">
              <UserAvatar className="home-avatar" src={currentAvatar} alt="Аватар" hasClownHat={user?.has_clown_hat} />
              <textarea
                className="create-post__input"
                placeholder="Что у вас нового?"
                value={postContent}
                onChange={(event) => setPostContent(event.target.value)}
              />
            </div>

            {postImagePreview && (
              <div className="create-post__preview">
                <img src={postImagePreview} alt="Предпросмотр" />
                <button
                  className="home-icon-button create-post__remove"
                  type="button"
                  onClick={() => {
                    setPostImage(null);
                    setPostImagePreview('');
                  }}
                  aria-label="Удалить изображение"
                >
                  <i className="fas fa-times" />
                </button>
              </div>
            )}

            <div className="create-post__actions">
              <button
                className="home-button home-button--ghost"
                type="button"
                onClick={() => document.getElementById('post-image')?.click()}
              >
                <i className="fas fa-image" />
                <span>Фото</span>
              </button>
              <input id="post-image" type="file" accept="image/*" onChange={handleImageSelect} />
              <button className="home-button home-button--primary" type="submit" disabled={posting || !postContent.trim()}>
                <span>{posting ? 'Публикуем...' : 'Опубликовать'}</span>
                <i className="fas fa-arrow-right" />
              </button>
            </div>
          </form>

          <section className="posts-feed" id="posts-feed">
            <div className="posts-feed__header">
              <div>
                <p className="home-kicker">Novogramm</p>
                <h2>Посты</h2>
              </div>
              <button className="home-icon-button" type="button" onClick={loadPosts} aria-label="Обновить посты">
                <i className={`fas fa-sync-alt ${loadingPosts ? 'fa-spin' : ''}`} />
              </button>
            </div>

            {loadingPosts && (
              <div className="home-state">
                <i className="fas fa-spinner fa-spin" />
                <span>Загружаем посты...</span>
              </div>
            )}

            {!loadingPosts && posts.length === 0 && (
              <div className="home-empty">
                <i className="fas fa-newspaper" />
                <h3>Пока нет постов</h3>
                <p>Опубликуйте первый пост, и он появится здесь.</p>
              </div>
            )}

            <div className="posts-feed__list">
              {posts.map((post) => {
                const imageSrc = postImageSrc(post);
                const comments = commentsByPost[post.id] || [];
                const commentsExpanded = expandedComments[post.id] || comments.length <= 5;
                const visibleComments = commentsExpanded ? comments : comments.slice(0, 5);
                const moderationMenuId = `feed-${post.id}`;

                return (
                  <article className="post-card" key={post.id}>
                    <div className="post-card__header">
                      <button
                        className="post-card__author-button"
                        type="button"
                        onClick={() => openUserProfile(post.user_id)}
                      >
                        <UserAvatar
                          className="home-avatar"
                          src={avatarSrc(post.user_avatar)}
                          alt="Аватар"
                          hasClownHat={post.user_has_clown_hat}
                        />
                        <span className="post-card__author">
                          <strong>{post.user_name || 'Пользователь'}</strong>
                          <small>{formatPostTime(post.created_at)}</small>
                        </span>
                      </button>
                      {user?.is_admin && (
                        <div className="post-card__moderation-menu" data-moderation-menu>
                          <button
                            className="home-icon-button post-card__more"
                            type="button"
                            aria-label="Действия модерации"
                            aria-haspopup="menu"
                            aria-expanded={openModerationMenu === moderationMenuId}
                            aria-controls={`moderation-menu-${moderationMenuId}`}
                            onClick={(event) => toggleModerationMenu(moderationMenuId, event)}
                          >
                            <i className="fas fa-ellipsis-h" />
                          </button>
                          {openModerationMenu === moderationMenuId && (
                            <div
                              className="post-card__moderation-dropdown"
                              id={`moderation-menu-${moderationMenuId}`}
                              role="menu"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                className="post-card__moderation-delete"
                                type="button"
                                role="menuitem"
                                onClick={(event) => handleModerationDelete(post.id, event)}
                                disabled={moderatingPostId === post.id}
                              >
                                <i className="far fa-trash-alt" />
                                <span>{moderatingPostId === post.id ? 'Удаляем...' : 'Удалить пост'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="post-card__content">
                      <p>{post.content}</p>
                      {imageSrc && <img className="post-card__image" src={imageSrc} alt="Изображение поста" />}
                    </div>

                    <div className="post-card__actions">
                      <button
                        className={`post-card__action ${post.is_liked ? 'is-liked' : ''}`}
                        type="button"
                        onClick={() => handleLike(post.id)}
                      >
                        <i className={`${post.is_liked ? 'fas' : 'far'} fa-heart`} />
                        <span>{post.likes_count || 0}</span>
                      </button>

                      <button className="post-card__action" type="button" onClick={() => toggleComments(post.id)}>
                        <i className="far fa-comment" />
                        <span>{post.comments_count || 0}</span>
                      </button>

                      <button className="post-card__action" type="button" aria-label="Поделиться">
                        <i className="far fa-share-square" />
                        <span>0</span>
                      </button>
                    </div>

                    <div className="post-card__comment-form">
                      <input
                        className="post-card__comment-input"
                        placeholder="Добавить комментарий"
                        value={commentDrafts[post.id] || ''}
                        onChange={(event) =>
                          setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void handleCommentSubmit(post.id);
                          }
                        }}
                      />
                      <button
                        className="home-icon-button post-card__send"
                        type="button"
                        onClick={() => handleCommentSubmit(post.id)}
                        aria-label="Отправить комментарий"
                      >
                        <i className="fas fa-paper-plane" />
                      </button>
                    </div>

                    {openComments[post.id] && (
                      <div className="post-card__comments">
                        {comments.length === 0 ? (
                          <div className="post-card__no-comments">Пока нет комментариев.</div>
                        ) : (
                          <>
                            {visibleComments.map((comment) => {
                              const moderationMenuId = `comment-${post.id}-${comment.id}`;

                              return (
                              <div className="comment-card" key={comment.id}>
                                <div className="comment-card__header">
                                  <div className="comment-card__user">
                                    <UserAvatar
                                      className="comment-card__avatar"
                                      src={avatarSrc(comment.user_avatar || post.user_avatar)}
                                      alt="Аватар"
                                      hasClownHat={comment.user_has_clown_hat}
                                    />
                                    <div>
                                      <strong>{comment.user_name || 'Пользователь'}</strong>
                                      <span>@{comment.user_username || 'username'}</span>
                                    </div>
                                  </div>
                                  <div className="comment-card__actions">
                                    <time>{formatPostTime(comment.created_at)}</time>
                                    {user?.is_admin && (
                                      <div className="post-card__moderation-menu" data-moderation-menu>
                                        <button
                                          className="home-icon-button comment-card__more"
                                          type="button"
                                          aria-label="Действия модерации комментария"
                                          aria-haspopup="menu"
                                          aria-expanded={openModerationMenu === moderationMenuId}
                                          aria-controls={`moderation-menu-${moderationMenuId}`}
                                          onClick={(event) => toggleModerationMenu(moderationMenuId, event)}
                                        >
                                          <i className="fas fa-ellipsis-h" />
                                        </button>
                                        {openModerationMenu === moderationMenuId && (
                                          <div
                                            className="post-card__moderation-dropdown"
                                            id={`moderation-menu-${moderationMenuId}`}
                                            role="menu"
                                            onClick={(event) => event.stopPropagation()}
                                          >
                                            <button
                                              className="post-card__moderation-delete"
                                              type="button"
                                              role="menuitem"
                                              onClick={() => void handleModerateComment(post.id, comment.id)}
                                              disabled={moderatingCommentId === comment.id}
                                            >
                                              <i className="far fa-trash-alt" />
                                              <span>{moderatingCommentId === comment.id ? 'Удаляем...' : 'Удалить комментарий'}</span>
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <p>{comment.content}</p>
                              </div>
                              );
                            })}

                            {comments.length > 5 && (
                              <button
                                className="post-card__comments-toggle"
                                type="button"
                                onClick={() =>
                                  setExpandedComments((current) => ({
                                    ...current,
                                    [post.id]: !current[post.id]
                                  }))
                                }
                              >
                                {commentsExpanded ? 'Скрыть комментарии' : `Показать все ${comments.length}`}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </main>
      </div>

      {(profileUser || profileLoading) && (
        <div className="home-profile-modal" role="dialog" aria-modal="true">
          <div className="home-profile-modal__card">
            <button className="home-icon-button home-profile-modal__close" type="button" onClick={closeProfile}>
              <i className="fas fa-times" />
            </button>

            {profileLoading && !profileUser ? (
              <div className="home-state">
                <i className="fas fa-spinner fa-spin" />
                <span>Открываем профиль...</span>
              </div>
            ) : (
              <>
                <div className="home-profile-modal__header">
                  <UserAvatar src={avatarSrc(profileUser.avatar)} alt="Аватар" hasClownHat={profileUser.has_clown_hat} />
                  <div>
                    <h2>{profileUser.name || 'Пользователь'}</h2>
                    <p>@{profileUser.username || 'username'}</p>
                    {profileUser.bio && <span>{profileUser.bio}</span>}
                  </div>
                </div>

                <div className="home-profile-modal__stats">
                  <span><strong>{profileUser.posts_count || profilePosts.length}</strong> постов</span>
                  <span><strong>{profileUser.followers_count || 0}</strong> подписчиков</span>
                  <span><strong>{profileUser.following_count || 0}</strong> подписок</span>
                </div>

                {profileUser.id !== user?.id && (
                  <div className="home-profile-modal__actions">
                    <button className={`home-button home-button--primary home-profile-modal__follow ${profileUser.is_following ? 'is-active' : ''}`} type="button" onClick={() => handleFollow(profileUser.id)}>
                      {profileUser.is_following ? 'Вы подписаны' : 'Подписаться'}
                    </button>
                    <button className="home-button home-button--ghost" type="button" onClick={() => startConversation(profileUser.id)}>Написать</button>
                    {user?.is_admin && !profileUser.is_admin && (
                      <button
                        className="home-button home-button--danger"
                        type="button"
                        onClick={handleUserBan}
                        disabled={banningUser}
                      >
                        {banningUser ? 'Обновляем...' : profileUser.is_banned ? 'Разбанить пользователя' : 'Заблокировать пользователя'}
                      </button>
                    )}
                    {user?.is_admin && !profileUser.is_admin && (
                      <button
                        className="home-button home-button--ghost"
                        type="button"
                        onClick={handleClownHat}
                        disabled={updatingClownHat}
                      >
                        {updatingClownHat ? 'Обновляем...' : profileUser.has_clown_hat ? 'Снять клоунскую шляпу' : 'Выдать клоунскую шляпу'}
                      </button>
                    )}
                  </div>
                )}

                <div className="home-profile-modal__posts">
                  {profilePosts.length === 0 ? (
                    <div className="home-empty home-empty--compact">
                      <i className="fas fa-newspaper" />
                      <h3>Постов пока нет</h3>
                    </div>
                  ) : (
                    profilePosts.map((post) => {
                      const imageSrc = postImageSrc(post);
                      const moderationMenuId = `profile-${post.id}`;

                      return (
                        <article className="home-profile-post" key={post.id}>
                          {user?.is_admin && (
                            <div className="post-card__moderation-menu" data-moderation-menu>
                              <button
                                className="home-icon-button post-card__more"
                                type="button"
                                aria-label="Действия модерации"
                                aria-haspopup="menu"
                                aria-expanded={openModerationMenu === moderationMenuId}
                                aria-controls={`moderation-menu-${moderationMenuId}`}
                                onClick={(event) => toggleModerationMenu(moderationMenuId, event)}
                              >
                                <i className="fas fa-ellipsis-h" />
                              </button>
                              {openModerationMenu === moderationMenuId && (
                                <div
                                  className="post-card__moderation-dropdown"
                                  id={`moderation-menu-${moderationMenuId}`}
                                  role="menu"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <button
                                    className="post-card__moderation-delete"
                                    type="button"
                                    role="menuitem"
                                    onClick={(event) => handleModerationDelete(post.id, event)}
                                    disabled={moderatingPostId === post.id}
                                  >
                                    <i className="far fa-trash-alt" />
                                    <span>{moderatingPostId === post.id ? 'Удаляем...' : 'Удалить пост'}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          <p>{post.content}</p>
                          {imageSrc && <img src={imageSrc} alt="Изображение поста" />}
                          <div>
                            <span><i className="far fa-heart" /> {post.likes_count || 0}</span>
                            <span><i className="far fa-comment" /> {post.comments_count || 0}</span>
                            <time>{formatPostTime(post.created_at)}</time>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default Home;
