export interface ToiletPaperBrand {
  name: string;
  tagline: string;
  color: string;
  bgLight: string;
  badge: string;
  icon: string;
}

export const PRESET_BRANDS: ToiletPaperBrand[] = [
  {
    name: '舒潔拉拉隊',
    tagline: '頂級三層柔韌・拉拉狗狗守護',
    color: '#2563eb',
    bgLight: '#eff6ff',
    badge: '經典頂級',
    icon: '🐶',
  },
  {
    name: '五月花厚棒隊',
    tagline: '厚實強韌一抽抵兩抽・永豐紙業名品',
    color: '#e11d48',
    bgLight: '#fff1f2',
    badge: '極厚抗拉',
    icon: '🌸',
  },
  {
    name: '春風柔情隊',
    tagline: '如沐春風・正隆造紙綠能經典',
    color: '#059669',
    bgLight: '#ecfdf5',
    badge: '國民柔韌',
    icon: '🍃',
  },
  {
    name: '蒲公英環保隊',
    tagline: '100% 再生紙愛地球・永續低碳',
    color: '#16a34a',
    bgLight: '#f0fdf4',
    badge: '綠色永續',
    icon: '🌱',
  },
  {
    name: '科克蘭霸王隊',
    tagline: '量販賣場巨無霸・三層厚抽囤貨必備',
    color: '#d97706',
    bgLight: '#fffbeb',
    badge: '好市多神話',
    icon: '🛒',
  },
  {
    name: '得意超值隊',
    tagline: '經濟實在好算盤・婆婆媽媽最愛',
    color: '#7c3aed',
    bgLight: '#f5f3ff',
    badge: '高CP首選',
    icon: '✨',
  },
  {
    name: '家樂福量販隊',
    tagline: '天天都便宜・量販促銷主力大牌',
    color: '#0284c7',
    bgLight: '#f0f9ff',
    badge: '賣場狂歡',
    icon: '🏪',
  },
  {
    name: '大潤發特攻隊',
    tagline: '安屎之亂風暴中心・行銷促銷始祖',
    color: '#dc2626',
    bgLight: '#fef2f2',
    badge: '歷史主角',
    icon: '📢',
  },
];

export const CIVICS_HISTORY = {
  title: '🎬 歷史真相：「2018 台灣衛生紙之亂（安屎之亂）」始末',
  date: '2018年2月23日 ~ 3月中旬',
  summary:
    '2018年2月，量販店公關不當向各大媒體發送「國際紙漿大漲，衛生紙預計3月將調漲10%～30%」的消息。媒體紛紛以顯著版面報導，隨即點燃全台民眾恐慌心理！',
  timeline: [
    {
      date: '2月23日',
      event: '媒體大幅報導衛生紙即將暴漲，網友紛紛轉傳，賣場瞬間湧入搶購人潮。',
    },
    {
      date: '2月24日~26日',
      event: '全台各大實體賣場、電商平台衛生紙全數被搬空！貨架上甚至出現「連廚房紙巾、面紙、濕紙巾都被掃光」的奇觀。',
    },
    {
      date: '2月27日',
      event: '行政院消保處、經濟部急忙出面澄清「紙漿原料無虞，衛生紙供應無虞，呼籲國人切勿恐慌囤積」。',
    },
    {
      date: '3月14日',
      event: '公平交易委員會火速調查完畢，認定量販業者發布不實漲價訊息誤導大眾並藉此促銷，嚴重破壞市場交易秩序，依《公平交易法》重罰 350 萬元！',
    },
  ],
  concepts: [
    {
      name: '寡占市場 (Oligopoly)',
      explanation: '市場上僅由少數幾家大型業者所掌控，彼此的定價與決策緊密互相牽動。',
    },
    {
      name: '聯合行為與卡特爾 (Cartel)',
      explanation:
        '《公平交易法》第14條：具競爭關係之事業不得共同約定商品價格、限制產量或劃分市場。若廠商私下協議定價，即屬違法卡特爾。',
    },
    {
      name: '囚徒困境 (Prisoner’s Dilemma)',
      explanation:
        '若所有廠商都維持高價（450元），全員利潤最大；但任何一家廠商只要偷降價（200元），就能奪取全場訂單。這種個人自利的背叛誘因，往往導致最終價格戰爆發！',
    },
    {
      name: '消費者剩餘 vs 廠商獲利',
      explanation:
        '當價格維持 450 元高檔時，生產者獲得暴利，消費者福利受損；反之當殺到 200 元時，消費者用最低廉成本買到生活必需品，但廠商利潤壓縮至成本邊緣。',
    },
  ],
};
