const CFG = {
  key: 'kancil-indonesian-v1',
  target: 'Indonesian',
  brand: 'Kancil',
  brandSub: 'bahasa Indonesia',
  voiceRe: /^(id|in)([-_]|$)/i,
  typing: true,
  romanization: false,
  scriptRe: null,
  properBase: ['Anda', 'Pak', 'Bu', 'Bapak', 'Ibu', 'Mas', 'Mbak', 'Kak', 'Dik'],
  syn: [
    ['saya', 'aku', 'gue'], ['kamu', 'anda', 'lo', 'kalian'], ['kami', 'kita'],
    ['tidak', 'nggak', 'bukan', 'belum', 'jangan'], ['sudah', 'udah'], ['saja', 'aja', 'cuma'],
    ['mau', 'ingin', 'akan'], ['bisa', 'boleh'], ['sekali', 'banget'], ['bagaimana', 'gimana'],
    ['pak', 'bu', 'mas', 'mbak', 'kak', 'dik', 'bapak', 'ibu'], ['tapi', 'tetapi'], ['kenapa', 'mengapa'],
    ['sedang', 'lagi'], ['sama', 'dengan'], ['tunggu', 'nunggu', 'menunggu'], ['cari', 'nyari', 'mencari'],
    ['kirim', 'mengirim', 'dikirim'], ['bantu', 'membantu'], ['beli', 'membeli'], ['jual', 'menjual'],
    ['ada', 'punya'],
  ],
  praise: [['Bagus!', 'Nice work.'], ['Benar!', 'That’s right.'], ['Hebat!', 'Great job.'], ['Mantap!', 'Excellent.']],
  endWord: ['Kerja bagus!', 'Good work.', ''],
  mascot(mood, size) {
    const mouth = mood === 'sad' ? '<path class="line" d="M44 79 Q50 74 56 79"/>'
      : mood === 'wow' ? '<ellipse class="ink" cx="50" cy="77" rx="3.6" ry="4.4"/>'
      : '<path class="line" d="M43 75 Q50 81 57 75"/>';
    const brows = mood === 'sad' ? '<path class="line" d="M31 43l9 3.5M69 43l-9 3.5"/>' : '';
    return `<svg class="mascot" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
      <ellipse class="coat" cx="27" cy="28" rx="9.5" ry="18" transform="rotate(-30 27 28)"/>
      <ellipse class="inner" cx="27.6" cy="29" rx="4.6" ry="11" transform="rotate(-30 27.6 29)"/>
      <ellipse class="coat" cx="73" cy="28" rx="9.5" ry="18" transform="rotate(30 73 28)"/>
      <ellipse class="inner" cx="72.4" cy="29" rx="4.6" ry="11" transform="rotate(30 72.4 29)"/>
      <ellipse class="coat" cx="50" cy="58" rx="31" ry="29"/>
      <ellipse class="muzzle" cx="50" cy="73" rx="17" ry="12.5"/>
      <circle class="ink" cx="38" cy="53" r="5.2"/><circle class="ink" cx="62" cy="53" r="5.2"/>
      <circle class="shine" cx="39.8" cy="51.2" r="1.7"/><circle class="shine" cx="63.8" cy="51.2" r="1.7"/>
      <ellipse class="ink" cx="50" cy="67.5" rx="4.6" ry="3.3"/>${brows}${mouth}</svg>`;
  },
};
