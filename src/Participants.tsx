import {useEffect, useState} from 'react';
import {Users, X} from 'lucide-react';
import type {SharedSession} from './SharedSession';

export default function Participants({session}: {session:SharedSession}) {
  const [people, setPeople] = useState(session.people);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let previous = new Set<string>();
    const seen = new Set<string>();
    const update = () => {
      const next = session.people;
      const added = next.filter(person => !person.self && !previous.has(person.id));
      if (session.voiceConnected && added.length) {
        const names = added.map(person => person.name).join(', ');
        setNotice(added.length === 1 ? `${names} ${seen.has(added[0].id) ? 'se ha reconectado' : 'se ha unido'} al documento.` : `${names} se han unido al documento.`);
      }
      next.forEach(person => seen.add(person.id));
      previous = new Set(next.map(person => person.id));
      setPeople(next);
    };
    update(); const unsubscribe = session.subscribe(update);
    return unsubscribe;
  }, [session]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  return <>
    <details className="participants-menu">
      <summary aria-label="Participantes del documento" title="Ver las conexiones activas al documento"><Users size={15}/><span>{session.voiceConnected ? people.length : 0} en línea</span></summary>
      <div className="participants-list">
        <strong>En este documento</strong>
        {!session.voiceConnected ? <p>Esperando conexión…</p> : people.map(person => <div key={person.id}><i style={{background:person.color}}/><span>{person.name}{person.self ? ' (tú)' : ''}</span></div>)}
        <small>{people.reduce((sum,person) => sum + person.connections, 0)} conexiones desde pestañas o dispositivos.</small>
      </div>
    </details>
    {notice && <div className="presence-notice" role="status"><Users size={16}/><span>{notice}</span><button aria-label="Cerrar aviso de participante" onClick={() => setNotice('')}><X size={14}/></button></div>}
  </>;
}
