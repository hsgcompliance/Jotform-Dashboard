export default function SubList({ subs, selected, onSelect }) {
  return (
    <ul style={{ listStyle:'none', padding:0 }}>
      {subs.map(s => (
        <li key={s.id} style={{ marginBottom:6 }}>
          <button
            onClick={() => onSelect(s)}
            style={{
              width:'100%', textAlign:'left',
              background:selected?.id===s.id?'#0070f3':'#f3f3f3',
              color:selected?.id===s.id?'#fff':'#000',
              border:'none', padding:'6px 8px', borderRadius:6, fontSize:13
            }}
          >
            {s.id}
          </button>
        </li>
      ))}
    </ul>
  );
}
