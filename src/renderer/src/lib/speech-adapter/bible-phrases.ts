import { getAllBookNames } from '../bible-book-matcher'

export function getBiblePhrases(language: string): string[] {
  const bookNames = getAllBookNames()
  const names: string[] = []

  for (const book of bookNames) {
    if (language === 'zh-TW') {
      names.push(book.zhTW)
    } else if (language === 'zh-CN') {
      names.push(book.zhCN)
    } else {
      names.push(book.en)
    }
  }

  const terms = language.startsWith('zh') ? CHINESE_CHURCH_TERMS : ENGLISH_CHURCH_TERMS
  return [...names, ...terms]
}

const CHINESE_CHURCH_TERMS = [
  '耶穌',
  '基督',
  '耶穌基督',
  '上帝',
  '天父',
  '聖靈',
  '聖經',
  '舊約',
  '新約',
  '福音',
  '信徒',
  '門徒',
  '使徒',
  '牧師',
  '傳道',
  '長老',
  '執事',
  '弟兄姊妹',
  '禱告',
  '恩典',
  '救恩',
  '十誡',
  '聖殿',
  '會幕',
  '十字架',
  '復活',
  '洗禮',
  '聖餐',
  '敬拜',
  '讚美',
  '阿們',
  '哈利路亞',
  '以馬內利',
  '第一章',
  '第二章',
  '第三章',
  '第一節',
  '第二節',
  '第三節'
]

const ENGLISH_CHURCH_TERMS = [
  'Jesus',
  'Christ',
  'Jesus Christ',
  'God',
  'Holy Spirit',
  'Bible',
  'Old Testament',
  'New Testament',
  'Gospel',
  'disciple',
  'apostle',
  'pastor',
  'elder',
  'prayer',
  'grace',
  'salvation',
  'baptism',
  'communion',
  'amen',
  'hallelujah',
  'chapter one',
  'chapter two',
  'chapter three',
  'verse one',
  'verse two',
  'verse three'
]
