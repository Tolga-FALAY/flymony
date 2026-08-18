import db from './database.js';

const updates = [
  {
    songId: 1780317401792,
    title: "Tutamıyorum Zamanı",
    year: 2001,
    notes: null
  },
  {
    songId: 1780317625930,
    title: "Kumralım",
    year: 1996,
    notes: null
  },
  {
    songId: 1780317772469,
    title: "Acılara Tutunmak",
    year: 1985,
    notes: "Ahmet Kaya (1985)"
  },
  {
    songId: 1780340759740,
    title: "İçim paramparça",
    year: 2011,
    notes: null
  },
  {
    songId: 1780341582216,
    title: "Paramparça",
    year: 2000,
    notes: "Teoman (2000)"
  },
  {
    songId: 1780343039630,
    title: "Saydım",
    year: 2004,
    notes: null
  },
  {
    songId: 1780434610183,
    title: "Bak",
    year: 2007,
    notes: null
  },
  {
    songId: 1780502450205,
    title: "Sabahçı Kahvesi",
    year: 1992,
    notes: null
  },
  {
    songId: 1780581773937,
    title: "İhtiyacım Var",
    year: 2026,
    notes: null
  },
  {
    songId: 1780608429581,
    title: "No woman no cry",
    year: 1974,
    notes: null
  },
  {
    songId: 1780608496308,
    title: "One Love One Heart",
    year: 1965,
    notes: null
  }
];

const updateStmtWithNotes = db.prepare('UPDATE Songs SET SongYear = ?, Notes = ? WHERE SongID = ?');
const updateStmtYearOnly = db.prepare('UPDATE Songs SET SongYear = ? WHERE SongID = ?');

const runUpdates = db.transaction(() => {
  for (const item of updates) {
    if (item.notes !== null) {
      updateStmtWithNotes.run(item.year, item.notes, item.songId);
      console.log(`Updated [${item.title}] (ID: ${item.songId}) -> Year: ${item.year}, Notes: "${item.notes}"`);
    } else {
      updateStmtYearOnly.run(item.year, item.songId);
      console.log(`Updated [${item.title}] (ID: ${item.songId}) -> Year: ${item.year}`);
    }
  }
});

runUpdates();

console.log("\nAll updates completed successfully.");
