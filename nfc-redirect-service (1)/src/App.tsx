/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Plus, Link as LinkIcon, Activity, Settings, ExternalLink, Trash2, X, Check, Globe, Smartphone, QrCode } from 'lucide-react';

interface SavedUrl {
  id: string;
  title: string;
  url: string;
}

interface Card {
  id: number;
  card_id: string;
  destination_url: string;
  is_active: number;
  created_at: string;
  saved_urls?: string; // JSON string
}

interface Stat {
  card_id: string;
  tap_count: number;
}

export default function App() {
  const [deviceToken, setDeviceToken] = useState<string | null>(null);

  useEffect(() => {
    // Check if we have a sync token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const syncToken = urlParams.get('sync');
    
    let currentToken = localStorage.getItem('device_token');
    
    if (syncToken) {
      // We are linking this device
      currentToken = syncToken;
      localStorage.setItem('device_token', currentToken);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (!currentToken) {
      // Generate a new anonymous device-bound identity
      currentToken = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('device_token', currentToken);
    }
    
    setDeviceToken(currentToken);
  }, []);

  if (!deviceToken) return null;

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        <header className="border-b bg-white">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-xl tracking-tight text-black">Node</h1>
            </div>
            <nav className="flex gap-6">
              <Link to="/" className="text-sm font-medium text-gray-600 hover:text-gray-900">Tableau de bord</Link>
            </nav>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard deviceToken={deviceToken} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function Dashboard({ deviceToken }: { deviceToken: string }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);

  // New card form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCardId, setNewCardId] = useState('');
  const [newDestinationUrl, setNewDestinationUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  // Sync state
  const [showSync, setShowSync] = useState(false);
  const [copied, setCopied] = useState(false);

  // Editing state
  const [editingCardId, setEditingCardId] = useState<number | null>(null);

  const fetchHeaders = {
    'Content-Type': 'application/json',
    'X-Device-Token': deviceToken
  };

  useEffect(() => {
    fetchData();
  }, [deviceToken]);

  const fetchData = async () => {
    try {
      const [cardsRes, statsRes] = await Promise.all([
        fetch('/api/cards', { headers: fetchHeaders }),
        fetch('/api/stats', { headers: fetchHeaders })
      ]);
      const cardsData = await cardsRes.json();
      const statsData = await statsRes.json();
      setCards(cardsData);
      setStats(statsData);
    } catch (err) {
      console.error('Erreur lors de la récupération des données', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify({ card_id: newCardId, destination_url: newDestinationUrl }),
      });
      if (res.ok) {
        setNewCardId('');
        setNewDestinationUrl('');
        setShowAddForm(false);
        setAddError('');
        fetchData();
      } else {
        const data = await res.json();
        setAddError(data.error || 'Erreur lors de l\'ajout de la carte');
      }
    } catch (err) {
      console.error('Erreur:', err);
      setAddError('Erreur de connexion');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/cards/${id}`, { 
        method: 'DELETE',
        headers: fetchHeaders
      });
      if (res.ok) {
        if (editingCardId === id) setEditingCardId(null);
        fetchData();
      }
    } catch (err) {
      console.error('Erreur de suppression:', err);
    }
  };

  const syncUrl = `${window.location.origin}/?sync=${deviceToken}`;

  if (loading) return <div className="text-gray-500 py-12 text-center animate-pulse">Chargement de vos liens...</div>;

  return (
    <div className="space-y-6">
      
      {/* DEVICE SYNC SECTION */}
      <div className="bg-gray-100 border border-gray-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <div>
            <h3 className="font-semibold text-black flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-gray-700" />
              Appareil lié
            </h3>
            <p className="text-sm text-gray-600 mt-1 max-w-xl">
              Votre compte est lié de manière anonyme à cet appareil. Pour gérer vos cartes sur un autre téléphone ou ordinateur sans tout perdre, utiliser le lien d'association.
            </p>
         </div>
         <button 
           onClick={() => setShowSync(!showSync)} 
           className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-800 w-full sm:w-auto text-center"
         >
             Lier un autre appareil
         </button>
      </div>

      {showSync && (
        <div className="bg-white border rounded-xl p-6 shadow-sm border-gray-200">
           <h4 className="font-semibold text-gray-900 mb-2">Lien d'association (Secret)</h4>
           <p className="text-sm text-gray-500 mb-4">Envoyez ce lien sur votre autre appareil et ouvrez-le. <strong>Attention : toute personne possédant ce lien aura accès à toutes vos cartes.</strong> Ne le partagez pas publiquement.</p>
           
           <div className="flex items-center gap-3">
             <input type="text" readOnly value={syncUrl} className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 select-all" />
             <button 
                onClick={() => {
                  navigator.clipboard.writeText(syncUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="bg-gray-100 border text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition"
             >
               {copied ? "Copié !" : "Copier"}
             </button>
           </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Vos Cartes NFC</h2>
          <p className="text-gray-500 text-sm mt-1">Gérez vos cartes physiques et leurs destinations URL.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Ajouter une carte
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddCard} className="bg-white border rounded-xl p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID de la Carte (Unique)</label>
              <input
                required
                type="text"
                placeholder="ex. ABC123DEF"
                className="w-full border-gray-300 rounded-lg shadow-sm focus:border-black focus:ring-black sm:text-sm px-3 py-2 border"
                value={newCardId}
                onChange={e => setNewCardId(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1.5">L'identifiant statique programmé sur la puce NFC.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL de base</label>
              <input
                required
                type="url"
                placeholder="https://example.com/promo"
                className="w-full border-gray-300 rounded-lg shadow-sm focus:border-black focus:ring-black sm:text-sm px-3 py-2 border"
                value={newDestinationUrl}
                onChange={e => setNewDestinationUrl(e.target.value)}
              />
            </div>
          </div>
          {addError && <p className="text-red-500 text-sm mt-3 font-medium">{addError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button" 
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Annuler
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-black text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition shadow-sm"
            >
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer la carte'}
            </button>
          </div>
        </form>
      )}

      {cards.length === 0 && !showAddForm ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl bg-white">
          <LinkIcon className="mx-auto h-10 w-10 text-gray-400 mb-3" />
          <h3 className="text-sm font-medium text-gray-900">Aucune carte</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">Créez votre première redirection pour analyser les taps.</p>
          <button 
            onClick={() => setShowAddForm(true)}
            className="text-black font-medium text-sm hover:underline"
          >
            Créer ma première carte
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {cards.map(card => {
            const tapCount = stats.find(s => s.card_id === card.card_id)?.tap_count || 0;
            const isEditing = editingCardId === card.id;

            return (
              <div key={card.id} className="bg-white border rounded-xl shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-black transition-shadow">
                {/* LIGNE PRINCIPALE DE LA CARTE */}
                <div className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${isEditing ? 'bg-gray-50/50 border-b' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-xs px-2.5 py-1 bg-gray-100/80 text-gray-700 rounded-md font-medium border border-gray-200">
                        {card.card_id}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        card.is_active === 1 ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {card.is_active === 1 ? 'Actif' : 'Désactivé'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <LinkIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <a 
                        href={card.destination_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-sm font-medium text-black hover:underline truncate"
                      >
                        {card.destination_url}
                      </a>
                    </div>
                    <div className="mt-3 text-[11px] text-gray-500 flex items-center gap-3 font-mono bg-gray-50 inline-flex px-2 py-1 rounded">
                      {window.location.origin}/r/{card.card_id}
                      <a href={`/r/${card.card_id}`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-black transition">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 border-t md:border-t-0 pt-4 md:pt-0">
                    <div className="flex flex-col items-center px-4 md:border-x border-gray-100">
                      <span className="text-2xl font-bold tracking-tight text-gray-900">{tapCount}</span>
                      <span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">Taps totaux</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setEditingCardId(isEditing ? null : card.id)}
                        className={`p-2 rounded-lg transition border flex items-center gap-2 text-sm font-medium ${
                          isEditing 
                          ? 'bg-gray-100 text-black border-gray-300 hover:bg-gray-200' 
                          : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
                        }`}
                      >
                        <Settings className="w-4 h-4" />
                        <span className="hidden sm:inline">Paramètres</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* ZONE D'EDITION */}
                {isEditing && (
                  <CardEditor 
                    card={card} 
                    deviceToken={deviceToken}
                    onSaved={fetchData} 
                    onDelete={() => handleDelete(card.id)} 
                    onClose={() => setEditingCardId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CardEditor({ card, deviceToken, onSaved, onDelete, onClose }: { card: Card, deviceToken: string, onSaved: () => void, onDelete: () => void, onClose: () => void }) {
  const [destinationUrl, setDestinationUrl] = useState(card.destination_url);
  const [isActive, setIsActive] = useState(card.is_active === 1);
  const [savedUrls, setSavedUrls] = useState<SavedUrl[]>(() => {
    try {
      return JSON.parse(card.saved_urls || '[]');
    } catch {
      return [];
    }
  });

  // New saved link state
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Apply changes to API instantly
  const syncWithServer = async (newDest: string, newActive: boolean, newSaved: SavedUrl[]) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Device-Token': deviceToken
        },
        body: JSON.stringify({ 
          destination_url: newDest, 
          is_active: newActive, 
          saved_urls: newSaved 
        }),
      });
      if (res.ok) {
        setSaveError('');
        onSaved(); // trigger parent refresh
      } else {
        setSaveError('Erreur serveur');
      }
    } catch (e) {
      console.error(e);
      setSaveError('Erreur de sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const setAsActiveUrl = (url: string) => {
    setDestinationUrl(url);
    syncWithServer(url, isActive, savedUrls);
  };

  const toggleStatus = () => {
    const nextStatus = !isActive;
    setIsActive(nextStatus);
    syncWithServer(destinationUrl, nextStatus, savedUrls);
  };

  const handleAddSavedUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;
    
    const newEntry: SavedUrl = { id: Date.now().toString(), title: newTitle, url: newUrl };
    const updated = [...savedUrls, newEntry];
    setSavedUrls(updated);
    setNewTitle('');
    setNewUrl('');
    syncWithServer(destinationUrl, isActive, updated);
  };

  const handleRemoveSavedUrl = (idToRemove: string) => {
    const updated = savedUrls.filter(u => u.id !== idToRemove);
    setSavedUrls(updated);
    syncWithServer(destinationUrl, isActive, updated);
  };

  const handleUpdateCurrentDest = (e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => {
    if ('key' in e && e.key !== 'Enter') return;
    if (destinationUrl !== card.destination_url) {
      syncWithServer(destinationUrl, isActive, savedUrls);
    }
  };

  return (
    <div className="p-6 bg-slate-50 border-t border-gray-100">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Colonne gauche : URL Actuelle + Statut */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Redirection Actuelle</label>
            <div className="flex mt-1 relative rounded-md shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                <Globe className="w-4 h-4" />
              </span>
              <input
                type="url"
                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-300 focus:ring-black focus:border-black sm:text-sm"
                value={destinationUrl}
                onChange={e => setDestinationUrl(e.target.value)}
                onBlur={handleUpdateCurrentDest}
                onKeyDown={handleUpdateCurrentDest}
                placeholder="https://..."
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">Appuyez sur Entrée pour sauvegarder l'URL manuellement.</p>
          </div>

          <div className="border-t border-gray-200 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Statut de la carte</h4>
                <p className="text-xs text-gray-500">Désactiver empêche la redirection.</p>
              </div>
              <button
                type="button"
                className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black ${isActive ? 'bg-black' : 'bg-gray-200'}`}
                onClick={toggleStatus}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${isActive ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
          
          <div className="pt-2">
             {!confirmDelete ? (
               <button 
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer définitivement la carte
                </button>
             ) : (
               <div className="flex items-center gap-3 text-sm bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                 <span className="font-medium text-red-800">Êtes-vous sûr ?</span>
                 <button type="button" onClick={onDelete} className="text-red-600 font-bold hover:underline">Oui, supprimer</button>
                 <button type="button" onClick={() => setConfirmDelete(false)} className="text-gray-600 hover:underline">Annuler</button>
               </div>
             )}
             {saveError && <p className="text-red-500 text-sm mt-2">{saveError}</p>}
          </div>
        </div>

        {/* Colonne droite : Multi-liens (Switch) */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Sites Enregistrés (Switch Rapide)</label>
          <div className="bg-white border rounded-lg overflow-hidden">
            <ul className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {savedUrls.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-gray-500">
                  Aucun site enregistré. Enregistrez-en pour switcher rapidement.
                </li>
              ) : (
                savedUrls.map(item => (
                  <li key={item.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition group">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-gray-500 truncate">{item.url}</p>
                    </div>
                    <div className="flex items-center gap-2">
                       {destinationUrl === item.url ? (
                         <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-black px-2 py-1 rounded">
                           <Check className="w-3 h-3" /> Actif
                         </span>
                       ) : (
                        <button
                          onClick={() => setAsActiveUrl(item.url)}
                          className="text-xs font-medium bg-white border border-gray-200 shadow-sm px-2.5 py-1.5 rounded hover:bg-gray-50 hover:text-black transition"
                        >
                          Activer
                        </button>
                       )}
                      <button
                        onClick={() => handleRemoveSavedUrl(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                        title="Supprimer ce raccourci"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
            <div className="bg-gray-50 border-t p-3">
              <form onSubmit={handleAddSavedUrl} className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Nom (ex: Mon C.V.)" 
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-1/3 text-sm border-gray-300 rounded shadow-sm px-2.5 py-1.5 focus:ring-black focus:border-black border"
                />
                <input 
                  type="url" 
                  placeholder="https://..." 
                  required
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  className="flex-1 text-sm border-gray-300 rounded shadow-sm px-2.5 py-1.5 focus:ring-black focus:border-black border min-w-0"
                />
                <button type="submit" disabled={isSaving} className="bg-gray-900 text-white rounded p-1.5 shadow-sm hover:bg-gray-800 transition">
                  <Plus className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        </div>

      </div>
      <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
        <button onClick={onClose} className="px-5 py-2 text-sm font-medium bg-white border shadow-sm rounded-lg hover:bg-gray-50 transition">
          Fermer les paramètres
        </button>
      </div>
    </div>
  );
}

