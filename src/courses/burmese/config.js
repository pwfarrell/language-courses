const CFG = {
  key: 'zaga-burmese-v1',
  target: 'Burmese',
  brand: 'Zaga',
  brandSub: 'စကား',
  voiceRe: /^my([-_]|$)/i,
  typing: false,
  romanization: true,
  scriptRe: /[က-႟]+(?:[\s…]+[က-႟]+)*/g,
  properBase: [],
  syn: [],
  praise: [['ကောင်းတယ်', 'Good.'], ['မှန်တယ်', 'Correct.'], ['တော်တယ်', 'Well done.']],
  endWord: ['ကောင်းလိုက်တာ', 'How great!', 'kaung-laik-ta'],
  mascot(mood, size) {
    const mouth = mood === 'sad' ? '<path class="mouth" d="M41 72 Q50 64 59 72"/>'
      : mood === 'wow' ? '<ellipse class="ink" cx="50" cy="69" rx="4.5" ry="5.5"/>'
      : '<path class="mouth" d="M40 66 Q50 76 60 66"/>';
    const brows = mood === 'sad' ? '<path class="mouth" style="stroke-width:3.5" d="M34 44l9 3M66 44l-9 3"/>' : '';
    return `<svg class="mascot" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
      <circle class="ink" cx="50" cy="13" r="9"/>
      <circle class="ring" cx="50" cy="57" r="35" stroke-width="9"/>
      <ellipse class="cheek" cx="32" cy="64" rx="8" ry="6"/><ellipse class="cheek" cx="68" cy="64" rx="8" ry="6"/>
      <circle class="ink" cx="40" cy="53" r="4.6"/><circle class="ink" cx="60" cy="53" r="4.6"/>${brows}${mouth}</svg>`;
  },
};
CFG.legacyIds = ["hello","thanks","yes","no","howru","imwell","nicemeet","sorry","itsok","dontund","slowly","alittle","bye","L_ka","L_kha","L_ga","L_nga","L_sa","L_hsa","L_ta","L_hta","L_na","L_pa","L_hpa","L_ma","L_la","L_ya","L_wa","L_tha","L_ha","L_a","tea","water","coffee","onecup","give","rice","eat","mohinga","delicious","eatenq","spicy","chicken","fish","nochili","dontwant","n1","n2","n3","n4","n5","n6","n7","n8","n9","n10","howmuch","kyat","thousand","expensive","discount","this","where","toilet","market","pagoda","right","left","straight","stophere","go","i_m","i_f","you_m","you_f","name","wherefrom","america","burmese","speak"];
