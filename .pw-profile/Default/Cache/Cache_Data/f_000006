// Q淘族 · 阳光群岛词库（人教版 PEP 3-6 年级 8 册核心词与常用短语全覆盖）
// 结构：
//   WORDS     前 60 条为手写老词（农场/海滩/森林）；其余按 52 座海岛自动展开
//   ISLANDS   海岛定义：key/name/emoji/主题色/圆心/半径 + rows=[en, zh, hint, spec]
//             spec 是参数化词宠工厂的配方（models.js 的 autoPet 解析）
//   分册       每个海岛词都标注 vol（3a…6b 哪一册）；按册切关、按册开图，不把所有册揉在一起
//   chaptersFor(sem)  当前册的关卡：固定的序章（农场/海滩/森林 60 词）+ 本册课本词
// 单词与短语都进 3D 场景：含空格的条目视为短语（短语岛 + 对话气泡标识牌）
import { EXTRA_ISLANDS } from './pep-extra.js';
import { CURRICULUM } from './curriculum.js';

// WORDS = 全部词宠（老词 + 海岛词）。前 60 条为手写老词（农场/海滩/森林），其余按 52 座海岛自动展开
const BASE_WORDS = [
  // ============ 出生草甸（初始可探索） ============
  { id: 'cat',     en: 'cat',     zh: '小猫',   syl: ['cat'],            hint: '喵喵叫，最爱晒太阳',            pet: 'cat',     pos: [-5, 24],   zone: 'meadow',
    story: '它总在谷仓顶上打盹，呼噜声像一台小小的拖拉机。' },
  { id: 'dog',     en: 'dog',     zh: '小狗',   syl: ['dog'],            hint: '人类最好的朋友，会握手',        pet: 'dog',     pos: [5, 26],    zone: 'meadow',
    story: '每天早上绕着农场跑三圈，尾巴摇得像一架小风车。' },
  { id: 'duck',    en: 'duck',    zh: '鸭子',   syl: ['duck'],           hint: '走路摇摇摆摆，嘎嘎叫',          pet: 'duck',    pos: [-11, 17],  zone: 'meadow',
    story: '走路摇摇摆摆，一下河却是人人佩服的游泳冠军。' },
  { id: 'rabbit',  en: 'rabbit',  zh: '兔子',   syl: ['rab', 'bit'],     hint: '长耳朵，爱吃萝卜',              pet: 'rabbit',  pos: [9, 14],    zone: 'meadow',
    story: '它的长耳朵特别灵，能听到三块田外萝卜发芽的声音。' },
  { id: 'mouse',   en: 'mouse',   zh: '老鼠',   syl: ['mouse'],          hint: '小小只，最爱奶酪',              pet: 'mouse',   pos: [-3, 11],   zone: 'meadow',
    story: '口袋里永远装着一小块饼干屑，说是留给远方的朋友。' },
  { id: 'frog',    en: 'frog',    zh: '青蛙',   syl: ['frog'],           hint: '绿色的跳跃健将，呱呱',          pet: 'frog',    pos: [13, 21],   zone: 'meadow',
    story: '每场雨停之后，它都会在荷叶上开一场个人演唱会。' },
  { id: 'flower',  en: 'flower',  zh: '花',     syl: ['flow', 'er'],     hint: '花园里香香的颜色',              pet: 'flower',  pos: [-13, 25],  zone: 'meadow',
    story: '会对着太阳点头问好，还把香味借给路过的蜜蜂。' },
  { id: 'grass',   en: 'grass',   zh: '草',     syl: ['grass'],          hint: '软软的绿地毯',                  pet: 'grass',   pos: [-8, 31],   zone: 'meadow',
    story: '一大片软软的绿地毯，光脚踩上去它会咯咯地笑。' },
  { id: 'boat',    en: 'boat',    zh: '小船',   syl: ['boat'],           hint: '水上代步的小交通工具',          pet: 'boat',    pos: [-2.5, 6.5], zone: 'meadow',
    story: '涨水的日子它最勇敢，驮着所有朋友稳稳地过河。' },
  { id: 'light',   en: 'light',   zh: '灯',     syl: ['light'],          hint: '黑暗里最需要它',                pet: 'light',   pos: [9, 31],    zone: 'meadow',
    story: '一盏不肯睡觉的小灯笼，专门照亮怕黑的小伙伴。' },
  { id: 'seed',    en: 'seed',    zh: '种子',   syl: ['seed'],           hint: '种进土里就会发芽',              pet: 'seed',    pos: [-14, 16],  zone: 'meadow',
    story: '睡在泥土里做一个长长的梦，梦里自己长成了大树。' },

  // ============ 果园（过河后） ============
  { id: 'apple',   en: 'apple',   zh: '苹果',   syl: ['ap', 'ple'],      hint: '红色的水果，保持健康靠它',      pet: 'apple',   pos: [-18, -13], zone: 'orchard',
    story: '它的红脸蛋不是害羞，是因为天天被夸甜。' },
  { id: 'banana',  en: 'banana',  zh: '香蕉',   syl: ['ba', 'na', 'na'], hint: '黄色的，猴子最爱',              pet: 'banana',  pos: [-27, -10], zone: 'orchard',
    story: '弯弯的身体，是它特意为小猴子准备的小月牙。' },
  { id: 'carrot',  en: 'carrot',  zh: '胡萝卜', syl: ['car', 'rot'],     hint: '橙色，兔子的最爱',              pet: 'carrot',  pos: [-13, -21], zone: 'orchard',
    story: '越是把身体藏进土里，越是盼着被小兔子发现。' },
  { id: 'tomato',  en: 'tomato',  zh: '西红柿', syl: ['to', 'ma', 'to'], hint: '红色蔬果，做菜生吃都行',        pet: 'tomato',  pos: [-23, -19], zone: 'orchard',
    story: '酸酸甜甜脾气最好，从来不红脸吵架——它本来就红。' },
  { id: 'potato',  en: 'potato',  zh: '土豆',   syl: ['po', 'ta', 'to'], hint: '土里的圆宝宝，薯条的前身',      pet: 'potato',  pos: [-9, -11],  zone: 'orchard',
    story: '圆滚滚的地里小球，全农场捉迷藏年年第一名。' },
  { id: 'corn',    en: 'corn',    zh: '玉米',   syl: ['corn'],           hint: '金黄的颗粒排排队',              pet: 'corn',    pos: [-29, -23], zone: 'orchard',
    story: '穿着绿色小外套，头顶留着一撮金黄色的流苏。' },
  { id: 'goat',    en: 'goat',    zh: '山羊',   syl: ['goat'],           hint: '下巴有胡子的爬山高手',          pet: 'goat',    pos: [-19, -7],  zone: 'orchard',
    story: '山羊爷爷的胡子白白的，最爱站在小山坡顶上看云。' },

  // ============ 风车田（大风球挡路，需 wind） ============
  { id: 'wind',    en: 'wind',    zh: '风',     syl: ['wind'],           hint: '摸不到，但能吹动风车',          pet: 'wind',    pos: [11, -6],   zone: 'windmill',
    story: '一位看不见的朋友，路过时会顺手替你接住帽子。' },
  { id: 'pig',     en: 'pig',     zh: '小猪',   syl: ['pig'],            hint: '粉色，爱在泥坑里打滚',          pet: 'pig',     pos: [21, -15],  zone: 'windmill',
    story: '在泥坑里痛痛快快打完滚，再自豪地抖一抖全身。' },
  { id: 'cow',     en: 'cow',     zh: '奶牛',   syl: ['cow'],            hint: '给我们牛奶的大家伙',            pet: 'cow',     pos: [28, -22],  zone: 'windmill',
    story: '慢性子嚼着草看云，一眼就能认出云朵的形状。' },
  { id: 'bird',    en: 'bird',    zh: '小鸟',   syl: ['bird'],           hint: '天上飞的小可爱',                pet: 'bird',    pos: [17, -25],  zone: 'windmill',
    story: '农场的晨间广播员，每天负责叫醒第一缕阳光。' },
  { id: 'bee',     en: 'bee',     zh: '蜜蜂',   syl: ['bee'],            hint: '嗡嗡嗡，酿蜜的小工人',          pet: 'bee',     pos: [25, -11],  zone: 'windmill',
    story: '提着小小花蜜桶，嗡嗡嗡地在花丛里送外卖。' },

  // ============ 谷仓外 ============
  { id: 'horse',   en: 'horse',   zh: '马',     syl: ['horse'],          hint: '嗒嗒嗒奔跑的大动物',            pet: 'horse',   pos: [31, 15],   zone: 'barnyard',
    story: '鬃毛像流动的火焰，跑起来蹄声嗒嗒嗒像打鼓。' },
  { id: 'sheep',   en: 'sheep',   zh: '绵羊',   syl: ['sheep'],          hint: '白白卷卷，像一朵云',            pet: 'sheep',   pos: [17, 27],   zone: 'barnyard',
    story: '一朵会走路的云，剪了毛也不生气，还夸新发型凉快。' },

  // ============ 谷仓内（黑黑的，需 light） ============
  { id: 'hen',     en: 'hen',     zh: '母鸡',   syl: ['hen'],            hint: '咯咯哒，会下蛋',                pet: 'hen',     pos: [22.5, 20.8], zone: 'barn',
    story: '每天下一个蛋，然后骄傲地咯咯哒宣传一整天。' },
  { id: 'milk',    en: 'milk',    zh: '牛奶',   syl: ['milk'],           hint: '白色的饮品，喝了长高高',        pet: 'milk',    pos: [25.5, 20.5], zone: 'barn',
    story: '装在纸盒里的小白云，喝一口就浑身是力气。' },
  { id: 'bread',   en: 'bread',   zh: '面包',   syl: ['bread'],          hint: '烤得香喷喷的主食',              pet: 'bread',   pos: [26, 23.5],   zone: 'barn',
    story: '刚出炉时最神气，香味能飘过农场的三条小街。' },
  { id: 'egg',     en: 'egg',     zh: '鸡蛋',   syl: ['egg'],            hint: '椭圆的，鸡妈妈的礼物',          pet: 'egg',     pos: [22.5, 23.5], zone: 'barn',
    story: '一枚椭圆的小太阳，敲开就是早餐时间的惊喜。' },
  { id: 'cake',    en: 'cake',    zh: '蛋糕',   syl: ['cake'],           hint: '生日那天必备的甜品',            pet: 'cake',    pos: [24, 22.5],   zone: 'barn',
    story: '生日当天它最闪亮，蜡烛是它的小王冠。' },
  { id: 'tractor', en: 'tractor', zh: '拖拉机', syl: ['trac', 'tor'],    hint: '农场里轰隆隆的大车',            pet: 'tractor', pos: [21.8, 22],   zone: 'barn',
    story: '农场的钢铁大牛，轰隆隆地翻出春天松软的泥土。' },

  // ============ 菜园（种豆得藤） ============
  { id: 'rain',    en: 'rain',    zh: '雨',     syl: ['rain'],           hint: '从云朵里落下的水',              pet: 'rain',    pos: [-26, 27],  zone: 'garden',
    story: '是云朵在打喷嚏，花草们一个个张着嘴接住。' },
  { id: 'tree',    en: 'tree',    zh: '大树',   syl: ['tree'],           hint: '高高的绿色大伞',                pet: 'tree',    pos: [-30, 20],  zone: 'garden',
    story: '举着一把绿色大伞，为野餐的大家挡住晒人的太阳。' },
  { id: 'sun',     en: 'sun',     zh: '太阳',   syl: ['sun'],            hint: '天上的金色球球',                pet: 'sun',     pos: [-19, 31],  zone: 'garden',
    story: '每天准时上班的金色球球，下班时会换成橘色。' },

  // ============ 天空岛（豆藤顶端） ============
  { id: 'star',    en: 'star',    zh: '星星',   syl: ['star'],           hint: '夜晚一闪一闪的',                pet: 'star',    pos: [-20.5, 24.5], zone: 'sky',
    story: '夜空里的萤火虫，一眨一眨，是在跟大家说晚安。' },
  { id: 'moon',    en: 'moon',    zh: '月亮',   syl: ['moon'],           hint: '弯弯的银色小船',                pet: 'moon',    pos: [-23.5, 25.5], zone: 'sky',
    story: '弯弯的银色小船，每天夜里载着全世界的梦。' },

  // ============ 阳光海滩（吹开沙墙后） ============
  { id: 'ship',    en: 'ship',    zh: '轮船',   syl: ['ship'],           hint: '海上轰隆隆的大船',              pet: 'ship',    pos: [-4, 39],   zone: 'beach',
    story: '海上的大个子，汽笛一响，海鸥都跟着它去旅行。' },
  { id: 'fish',    en: 'fish',    zh: '鱼',     syl: ['fish'],           hint: '在水里游来游去',                pet: 'fish',    pos: [8, 40],    zone: 'beach',
    story: '眨眼的功夫就能从礁石游到沙滩，游泳比赛从不输。' },
  { id: 'ball',    en: 'ball',    zh: '皮球',   syl: ['ball'],           hint: '圆圆的，能拍能踢',              pet: 'ball',    pos: [16, 40],   zone: 'beach',
    story: '圆滚滚的捣蛋鬼，一拍就蹦得老高，谁都追不上。' },
  { id: 'kite',    en: 'kite',    zh: '风筝',   syl: ['kite'],           hint: '牵着线飞上天的',                pet: 'kite',    pos: [-20, 38],  zone: 'beach',
    story: '最喜欢大风天，飞得比楼还高，尾巴上的蝴蝶结哗啦啦。' },
  { id: 'whale',   en: 'whale',   zh: '鲸鱼',   syl: ['whale'],          hint: '海里最大的动物',                pet: 'whale',   pos: [-12, 42],  zone: 'beach',
    story: '大海里最大的歌手，喷出的水柱比房子还高。' },
  { id: 'crab',    en: 'crab',    zh: '螃蟹',   syl: ['crab'],           hint: '横着走路，举着大钳子',          pet: 'crab',    pos: [14, 43],   zone: 'beach',
    story: '沙滩上的横行小将军，挥着两把大钳子天天操练。' },
  { id: 'sea',     en: 'sea',     zh: '大海',   syl: ['sea'],            hint: '很大很大的蓝色水域',            pet: 'sea',     pos: [18, 44],   zone: 'beach',
    story: '蓝蓝的大摇篮，摇晃着所有的船和小鱼睡觉。' },
  { id: 'shell',   en: 'shell',   zh: '贝壳',   syl: ['shell'],          hint: '海滩上能捡到的',                pet: 'shell',   pos: [-18, 42],  zone: 'beach',
    story: '大海的小喇叭，贴在耳朵上能听见海浪的歌。' },
  { id: 'sand',    en: 'sand',    zh: '沙子',   syl: ['sand'],           hint: '金灿灿软绵绵，堆城堡全靠它',    pet: 'sand',    pos: [10, 46],   zone: 'beach',
    story: '数不清的金色小颗粒，是堆沙堡最好的砖头。' },
  { id: 'wave',    en: 'wave',    zh: '浪花',   syl: ['wave'],           hint: '卷着白边冲上岸',                pet: 'wave',    pos: [-8, 47],   zone: 'beach',
    story: '大海伸出的白花边小手，挠得脚丫子咯咯笑。' },
  { id: 'starfish', en: 'starfish', zh: '海星', syl: ['star', 'fish'],   hint: '像星星一样趴在沙滩上',          pet: 'starfish', pos: [4, 47],   zone: 'beach',
    story: '海里的五角星，走路慢吞吞，趴着睡大觉。' },
  { id: 'icecream', en: 'ice cream', zh: '冰淇淋', syl: ['ice', 'cream'], hint: '甜甜的、凉凉的夏天甜点',        pet: 'icecream', pos: [-16, 45], zone: 'beach',
    story: '太阳越晒它越开心，因为小朋友们都排着队等它。' },

  // ============ 神秘森林（拨开荆棘后） ============
  { id: 'owl',     en: 'owl',     zh: '猫头鹰', syl: ['owl'],            hint: '夜里值班，咕咕叫',              pet: 'owl',     pos: [-42, -10], zone: 'forest',
    story: '森林的夜间守卫，睁着大眼睛替大家看星星。' },
  { id: 'leaf',    en: 'leaf',    zh: '树叶',   syl: ['leaf'],           hint: '秋天会变黄飘落',                pet: 'leaf',    pos: [-44, -16], zone: 'forest',
    story: '大树寄给地面的明信片，落下来时会转着圈跳舞。' },
  { id: 'stone',   en: 'stone',   zh: '石头',   syl: ['stone'],          hint: '硬硬的，河边的灰色小块',        pet: 'stone',   pos: [-40, -4],  zone: 'forest',
    story: '最有耐心的大力士，蹲在溪边数了一百年小鱼。' },
  { id: 'wood',    en: 'wood',    zh: '木头',   syl: ['wood'],           hint: '砍下来的树干',                  pet: 'wood',    pos: [-46, -6],  zone: 'forest',
    story: '躺着也干活的小木头，啄木鸟把它当成敲门的家。' },
  { id: 'fox',     en: 'fox',     zh: '狐狸',   syl: ['fox'],            hint: '尖耳朵大尾巴，很聪明',          pet: 'fox',     pos: [-48, 2],   zone: 'forest',
    story: '森林里的小机灵鬼，蓬蓬大尾巴一扫就是一个枕头。' },
  { id: 'bear',    en: 'bear',    zh: '熊',     syl: ['bear'],           hint: '爱吃蜂蜜的壮家伙',              pet: 'bear',    pos: [-44, 8],   zone: 'forest',
    story: '抱着蜂蜜罐打呼噜的大家伙，冬天要睡长长一觉。' },
  { id: 'panda',   en: 'panda',   zh: '熊猫',   syl: ['pan', 'da'],      hint: '黑白相间，爱吃竹子',            pet: 'panda',   pos: [-48, 10],  zone: 'forest',
    story: '戴着黑墨镜的竹子大胃王，吃完就靠着树打滚。' },
  { id: 'monkey',  en: 'monkey',  zh: '猴子',   syl: ['mon', 'key'],     hint: '爬树高手，爱吃香蕉',            pet: 'monkey',  pos: [-46, 16],  zone: 'forest',
    story: '树梢上的杂技演员，尾巴一卷就能倒挂看世界。' },
  { id: 'deer',    en: 'deer',    zh: '鹿',     syl: ['deer'],           hint: '头上长着树枝一样的角',          pet: 'deer',    pos: [-40, 14],  zone: 'forest',
    story: '森林里的小绅士，头顶的角像一顶开花的王冠。' },
  { id: 'squirrel', en: 'squirrel', zh: '松鼠', syl: ['squir', 'rel'],   hint: '大尾巴，爱囤松果',              pet: 'squirrel', pos: [-40, 20], zone: 'forest',
    story: '毛茸茸的小管家，把松果藏得到处都是，再慢慢找。' },
  { id: 'nest',    en: 'nest',    zh: '鸟窝',   syl: ['nest'],           hint: '小鸟的家，树枝搭成',            pet: 'nest',    pos: [-46, 20],  zone: 'forest',
    story: '树上圆圆的小摇篮，风一吹，小鸟们就睡着了。' },
  { id: 'mushroom', en: 'mushroom', zh: '蘑菇', syl: ['mush', 'room'],   hint: '雨后伞一样冒出来',              pet: 'mushroom', pos: [-48, -12], zone: 'forest',
    story: '森林里的小雨伞，下雨天蚂蚁们排队来躲雨。' },
];

// ================= 海岛词表 =================
// rows: [en, zh, hint, spec]  —— spec 由 models.js 的 autoPet() 解析成词宠模型
export const ISLANDS = [
  { key: 'rainbow', name: '彩虹糖果岛', emoji: '🍬', color: '#F5D9EC', cx: 31.9, cz: -92.7, r: 18, style: 'mixed',
    rows: [
      ['red', '红色', '太阳的颜色，也是过奖状的颜色', 'drop:#E84B4B'],
      ['yellow', '黄色', '小鸭子和香蕉的颜色', 'drop:#FFD44E'],
      ['green', '绿色', '草地和树叶的颜色', 'drop:#5CB85C'],
      ['blue', '蓝色', '天空和大海的颜色', 'drop:#3E8FD9'],
      ['black', '黑色', '黑夜和黑板上字的颜色', 'drop:#3A3A44'],
      ['white', '白色', '云朵和牛奶的颜色', 'drop:#FFFDF6'],
      ['orange', '橙色', '既是橙子也是一种颜色', 'fruit2:orange'],
      ['brown', '棕色', '小熊和巧克力的颜色', 'drop:#8A5A3C'],
      ['happy', '高兴的', '咧嘴笑的样子', 'feel:happy'],
      ['sad', '难过的', '掉眼泪的样子', 'feel:sad'],
      ['angry', '生气的', '眉毛竖起来的样子', 'feel:angry'],
      ['afraid', '害怕的', '吓得发抖的样子', 'feel:afraid'],
      ['worried', '担心的', '皱着眉头的样子', 'feel:worried'],
      ['candy', '糖果', '甜甜的，糖纸上包着的', 'food:candy'],
      ['fruit', '水果', '苹果香蕉梨都是它', 'food:fruitbasket'],
    ] },
  { key: 'body', name: '身体岛', emoji: '🧍', color: '#FBE8D8', cx: -28.7, cz: 93.7, r: 18, style: 'tree',
    rows: [
      ['face', '脸', '五官都住在上面', 'body:face'],
      ['ear', '耳朵', '听声音用', 'body:ear'],
      ['eye', '眼睛', '看世界的窗户', 'body:eye'],
      ['nose', '鼻子', '闻味道的小山丘', 'body:nose'],
      ['mouth', '嘴巴', '吃饭说话都用它', 'body:mouth'],
      ['arm', '手臂', '举起来就是加油', 'body:arm'],
      ['hand', '手', '五根手指头', 'body:hand'],
      ['head', '头', '帽子戴的地方', 'body:head'],
      ['body', '身体', '从头到脚就是你', 'body:body'],
      ['leg', '腿', '走路跑步全靠它', 'body:leg'],
      ['hair', '头发', '长在头顶的小草', 'body:hair'],
    ] },
  { key: 'zoo', name: '动物园岛', emoji: '🦁', color: '#E8E4C8', cx: 1, cz: 58, r: 20, style: 'tree',
    rows: [
      ['tiger', '老虎', '森林之王，有条纹', 'quad:tiger'],
      ['elephant', '大象', '长鼻子，大耳朵', 'quad:elephant'],
      ['giraffe', '长颈鹿', '脖子最长的动物', 'quad:giraffe'],
      ['animal', '动物', '猫狗老虎都是它', 'quad:animal'],
      ['zoo', '动物园', '动物们住的大公园', 'place:zoo'],
      ['mule', '骡子', '马和驴的宝宝', 'quad:mule'],
      ['funny', '滑稽的', '能让大家哈哈笑', 'word:clown'],
      ['tall', '高的', '长颈鹿的样子', 'word:tall'],
      ['short', '矮的', '和高的反着来', 'word:short'],
      ['fat', '胖的', '圆滚滚的样子', 'word:fat'],
      ['thin', '瘦的', '和胖的反着来', 'word:thin'],
      ['long', '长的', '火车那么长', 'word:long'],
      ['small', '小的', '蚂蚁那么小', 'word:small'],
      ['big', '大的', '大象那么大', 'word:big'],
      ['these', '这些', '指身边的几个', 'word:these'],
    ] },
  { key: 'numbers', name: '数字星星岛', emoji: '🔢', color: '#D8E4F5', cx: 47.2, cz: -48.9, r: 20, style: 'pine',
    rows: [
      ['one', '一', '独一根', 'num:1'],
      ['two', '二', '成双成对', 'num:2'],
      ['three', '三', '三角形的边数', 'num:3'],
      ['four', '四', '小汽车四个轮', 'num:4'],
      ['five', '五', '一只手的手指头', 'num:5'],
      ['six', '六', '骰子的一半', 'num:6'],
      ['seven', '七', '一周有七天', 'num:7'],
      ['eight', '八', '两个雪人叠罗汉', 'num:8'],
      ['nine', '九', '十减一', 'num:9'],
      ['ten', '十', '两只手的手指头', 'num:10'],
      ['eleven', '十一', '十加一', 'num:11'],
      ['twelve', '十二', '一年有十二个月', 'num:12'],
      ['thirteen', '十三', '十加三', 'num:13'],
      ['fourteen', '十四', '十加四', 'num:14'],
      ['fifteen', '十五', '十加五', 'num:15'],
      ['sixteen', '十六', '十加六', 'num:16'],
      ['seventeen', '十七', '十加七', 'num:17'],
      ['eighteen', '十八', '十加八', 'num:18'],
      ['nineteen', '十九', '十加九', 'num:19'],
      ['twenty', '二十', '两个十', 'num:20'],
      ['forty', '四十', '四个十', 'num:40'],
    ] },
  { key: 'family', name: '亲情小镇', emoji: '🏡', color: '#F5E8D0', cx: -35.1, cz: -91.5, r: 19, style: 'house',
    rows: [
      ['father', '爸爸', '妈妈的另一半', 'doll:father'],
      ['mother', '妈妈', '最爱你的大人', 'doll:mother'],
      ['man', '男人', '长大后的男孩', 'doll:man'],
      ['woman', '女人', '长大后的女孩', 'doll:woman'],
      ['grandmother', '奶奶', '爸爸的妈妈', 'doll:grandmother'],
      ['grandfather', '爷爷', '爸爸的爸爸', 'doll:grandfather'],
      ['sister', '姐妹', '同爸同妈的女生', 'doll:sister'],
      ['brother', '兄弟', '同爸同妈的男生', 'doll:brother'],
      ['family', '家庭', '一家人整整齐齐', 'doll:family'],
      ['parents', '父母', '爸爸加妈妈', 'doll:parents'],
      ['uncle', '叔叔', '爸爸的兄弟', 'doll:uncle'],
      ['aunt', '姑姑', '爸爸的姐妹', 'doll:aunt'],
      ['hello', '你好', '见面的第一句话', 'doll:hello'],
      ['hi', '嗨', '更随意的你好', 'doll:hi'],
      ['goodbye', '再见', '分开时说的话', 'doll:goodbye'],
    ] },
  { key: 'food', name: '美食大陆', emoji: '🍚', color: '#F5E0C8', cx: 58, cz: 0, r: 22, style: 'mixed',
    rows: [
      ['juice', '果汁', '水果榨成的饮料', 'drink:juice'],
      ['water', '水', '透明解渴的生命之源', 'drink:water'],
      ['rice', '米饭', '白白的，香香的', 'food:rice'],
      ['hamburger', '汉堡包', '面包夹肉和菜', 'food:burger'],
      ['beef', '牛肉', '牛身上的肉', 'food:beef'],
      ['chicken', '鸡肉', '烤鸡的味道', 'food:chicken'],
      ['noodles', '面条', '长长的，吸溜吸溜', 'food:noodles'],
      ['soup', '汤', '热乎乎喝的', 'food:soup'],
      ['vegetable', '蔬菜', '健康餐里的绿色', 'food:vegetable'],
      ['chopsticks', '筷子', '中国吃饭用的两根棍', 'tool:chopsticks'],
      ['bowl', '碗', '圆圆的盛饭容器', 'tool:bowl'],
      ['fork', '叉子', '扎着吃的餐具', 'tool:fork'],
      ['knife', '刀', '切东西的餐具', 'tool:knife'],
      ['spoon', '勺子', '喝汤用的餐具', 'tool:spoon'],
      ['breakfast', '早餐', '起床后的第一餐', 'food:breakfast'],
      ['lunch', '午餐', '中午吃的饭', 'food:lunch'],
      ['dinner', '晚餐', '晚上全家吃的饭', 'food:dinner'],
      ['sandwich', '三明治', '两片面包夹一切', 'food:sandwich'],
      ['salad', '沙拉', '凉拌蔬菜水果', 'food:salad'],
      ['tea', '茶', '爷爷爱喝的热饮', 'drink:tea'],
      ['sweet', '甜的', '糖果的味道', 'food:sweet'],
      ['fresh', '新鲜的', '刚摘下来的感觉', 'word:fresh'],
      ['healthy', '健康的', '蔬菜水果带给你的', 'word:healthy'],
      ['delicious', '美味的', '好吃到舔盘子', 'word:delicious'],
      ['pear', '梨', '像葫芦的水果', 'fruit2:pear'],
      ['watermelon', '西瓜', '绿皮红瓤大圆瓜', 'fruit2:watermelon'],
      ['grape', '葡萄', '一串小圆球', 'fruit2:grape'],
    ] },
  { key: 'home', name: '温馨家园', emoji: '🛋️', color: '#E8D8E0', cx: -48.9, cz: -47.2, r: 20, style: 'house',
    rows: [
      ['bedroom', '卧室', '睡觉的房间', 'place:bedroom'],
      ['study', '书房', '看书学习的房间', 'place:study'],
      ['kitchen', '厨房', '做饭的房间', 'place:kitchen'],
      ['bathroom', '浴室', '洗澡刷牙的房间', 'place:bathroom'],
      ['bed', '床', '晚上躺上去睡觉', 'furn:bed'],
      ['phone', '电话', '打电话用的', 'furn:phone'],
      ['table', '桌子', '吃饭写作业的地方', 'furn:table'],
      ['sofa', '沙发', '软软的座位', 'furn:sofa'],
      ['fridge', '冰箱', '冷藏食物的大柜子', 'furn:fridge'],
      ['desk', '书桌', '写字的桌子', 'furn:desk'],
      ['chair', '椅子', '坐着的家具', 'furn:chair'],
      ['window', '窗户', '墙上透光的格子', 'furn:window'],
      ['door', '门', '进出房间要开它', 'furn:door'],
      ['wall', '墙壁', '房子的四面', 'furn:wall'],
      ['floor', '地板', '脚底下踩的', 'furn:floor'],
      ['clock', '时钟', '滴答滴答报时间', 'furn:clock'],
      ['plant', '植物', '窗台上的绿盆栽', 'furn:plant'],
      ['bottle', '瓶子', '装水的小容器', 'furn:bottle'],
      ['photo', '照片', '定格的美好瞬间', 'furn:photo'],
    ] },
  { key: 'school', name: '学堂书院', emoji: '📚', color: '#D8E8DC', cx: 48.1, cz: 48.1, r: 20, style: 'pine',
    rows: [
      ['classroom', '教室', '上课的大房间', 'place:classroom'],
      ['blackboard', '黑板', '老师写字的绿板子', 'furn:blackboard'],
      ['picture', '图画', '墙上挂的画', 'furn:picture'],
      ['computer', '计算机', '会思考的机器', 'furn:computer'],
      ['schoolbag', '书包', '背着书本上学去', 'cloth:schoolbag'],
      ['book', '书', '一页一页的知识', 'tool:book'],
      ['pencil', '铅笔', '木头杆写字笔', 'tool:pencil'],
      ['pen', '钢笔', '吸墨水的笔', 'tool:pen'],
      ['ruler', '尺子', '画直线量长短', 'tool:ruler'],
      ['eraser', '橡皮', '擦掉写错的', 'tool:eraser'],
      ['notebook', '笔记本', '记作业的小本子', 'tool:notebook'],
      ['homework', '作业', '放学后的任务', 'word:homework'],
      ['class', '班级', '一起上学的集体', 'word:class'],
      ['playground', '操场', '下课撒欢的地方', 'place:playground'],
      ['library', '图书馆', '安静看书的地方', 'place:library'],
      ['gym', '体育馆', '室内运动的场馆', 'place:gym'],
      ['garden', '花园', '种花的小园子', 'place:garden'],
      ['dictionary', '词典', '查单词的大厚书', 'tool:dictionary'],
      ['Internet', '互联网', '把全世界的电脑连起来', 'word:internet'],
    ] },
  { key: 'clothes', name: '衣帽精品店', emoji: '👕', color: '#E0E4F5', cx: -88.4, cz: 37.5, r: 17, style: 'mixed',
    rows: [
      ['cap', '鸭舌帽', '前面带檐的帽子', 'cloth:cap'],
      ['hat', '帽子', '头上戴的', 'cloth:hat'],
      ['sunglasses', '太阳镜', '大太阳天戴的眼镜', 'cloth:sunglasses'],
      ['scarf', '围巾', '冬天围在脖子上', 'cloth:scarf'],
      ['gloves', '手套', '五指的小房子', 'cloth:gloves'],
      ['umbrella', '雨伞', '下雨天撑开它', 'cloth:umbrella'],
      ['coat', '外套', '最外面的衣服', 'cloth:coat'],
      ['sweater', '毛衣', '毛线织的上衣', 'cloth:sweater'],
      ['jacket', '夹克', '拉链的外套', 'cloth:jacket'],
      ['shirt', '衬衫', '有领子的上衣', 'cloth:shirt'],
      ['shoe', '鞋子', '穿在脚上', 'cloth:shoe'],
      ['glasses', '眼镜', '近视了就戴它', 'cloth:glasses'],
    ] },
  { key: 'town', name: '热闹街镇', emoji: '🏪', color: '#E0E0E8', cx: -1, cz: -58, r: 21, style: 'house',
    rows: [
      ['car', '小汽车', '四个轮子跑得快', 'veh:car'],
      ['bike', '自行车', '两个轮子踩着走', 'veh:bike'],
      ['toy', '玩具', '陪你玩的好朋友', 'word:toy'],
      ['expensive', '昂贵的', '价格很高', 'word:expensive'],
      ['cheap', '便宜的', '价格很低', 'word:cheap'],
      ['nice', '好看的', '让人舒服的', 'word:nice'],
      ['pretty', '美观的', '漂亮的意思', 'word:pretty'],
      ['size', '尺码', '衣服鞋子的大小', 'word:size'],
      ['sale', '特价', '打折啦快去买', 'word:sale'],
      ['supermarket', '超市', '什么都卖的大商店', 'place:supermarket'],
      ['bookstore', '书店', '卖书的店', 'place:bookstore'],
      ['cinema', '电影院', '看大银幕的地方', 'place:cinema'],
      ['hospital', '医院', '生病了去的地方', 'place:hospital'],
      ['crossing', '十字路口', '两条路交叉的地方', 'word:crossing'],
      ['near', '在附近', '不远就是它', 'word:near'],
      ['stop', '停下', '红灯亮了要停', 'word:stop'],
      ['UK', '英国', '伦敦大桥的国家', 'place:uk'],
      ['Canada', '加拿大', '枫叶之国', 'place:canada'],
      ['USA', '美国', '白宫的国家', 'place:usa'],
      ['China', '中国', '我们的祖国', 'place:china'],
    ] },
  { key: 'weather', name: '四季天气岛', emoji: '🌦️', color: '#D0E4EE', cx: 91.5, cz: -35.1, r: 19, style: 'pine',
    rows: [
      ['cold', '寒冷的', '冬天的北风感觉', 'weather:cold'],
      ['cool', '凉爽的', '秋天舒服的凉', 'weather:cool'],
      ['warm', '温暖的', '春天太阳的感觉', 'weather:warm'],
      ['hot', '炎热的', '夏天太阳的感觉', 'weather:hot'],
      ['sunny', '晴朗的', '大太阳的好天气', 'weather:sunny'],
      ['windy', '有风的', '风呼呼吹的天气', 'weather:windy'],
      ['cloudy', '多云的', '天空布满云朵', 'weather:cloudy'],
      ['snowy', '下雪的', '雪花飘飘的天气', 'weather:snowy'],
      ['rainy', '下雨的', '要带伞的天气', 'weather:rainy'],
      ['weather', '天气', '晴天雨天都是它', 'weather:weather'],
      ['spring', '春天', '开花放风筝的季节', 'season:spring'],
      ['summer', '夏天', '吃西瓜游泳的季节', 'season:summer'],
      ['autumn', '秋天', '落叶丰收的季节', 'season:autumn'],
      ['winter', '冬天', '堆雪人的季节', 'season:winter'],
      ['season', '季节', '春夏秋冬都是它', 'season:season'],
      ['picnic', '野餐', '草地上铺布吃饭', 'season:picnic'],
    ] },
  { key: 'jobs', name: '职业广场', emoji: '👮', color: '#E4E8D8', cx: -92.7, cz: -31.9, r: 19, style: 'house',
    rows: [
      ['student', '学生', '在学校学习的人', 'doll:student'],
      ['teacher', '老师', '学校里教书的', 'doll:teacher'],
      ['friend', '朋友', '一起玩的小伙伴', 'doll:friend'],
      ['boy', '男孩', '男孩子', 'doll:boy'],
      ['girl', '女孩', '女孩子', 'doll:girl'],
      ['doctor', '医生', '生病了找他看', 'doll:doctor'],
      ['driver', '司机', '开车的人', 'doll:driver'],
      ['farmer', '农民', '种庄稼的人', 'doll:farmer'],
      ['nurse', '护士', '照顾病人的天使', 'doll:nurse'],
      ['job', '工作', '大人每天做的事', 'word:job'],
      ['postman', '邮递员', '送信送包裹', 'doll:postman'],
      ['businessman', '商人', '谈生意的人', 'doll:businessman'],
      ['fisherman', '渔民', '捕鱼的人', 'doll:fisherman'],
      ['scientist', '科学家', '做研究发明的人', 'doll:scientist'],
      ['pilot', '飞行员', '开飞机的人', 'doll:pilot'],
      ['coach', '教练', '训练队员的人', 'doll:coach'],
      ['reporter', '记者', '采访报道新闻', 'doll:reporter'],
    ] },
  { key: 'time', name: '时光城堡', emoji: '⏰', color: '#E8E0F5', cx: -58, cz: 2, r: 22, style: 'house',
    rows: [
      ['Monday', '星期一', '一周的第一天', 'time2:weekday:1'],
      ['Tuesday', '星期二', '周一的第二天', 'time2:weekday:2'],
      ['Wednesday', '星期三', '一周过半前后', 'time2:weekday:3'],
      ['Thursday', '星期四', '周五的前一天', 'time2:weekday:4'],
      ['Friday', '星期五', '快乐周五啦', 'time2:weekday:5'],
      ['Saturday', '星期六', '不用上学的日子', 'time2:weekday:6'],
      ['Sunday', '星期日', '一周的最后一天', 'time2:weekday:7'],
      ['weekend', '周末', '周六加周日', 'time2:weekend'],
      ['tomorrow', '明天', '今天过完的那天', 'time2:tomorrow'],
      ['tonight', '今晚', '今天晚上', 'time2:tonight'],
      ['yesterday', '昨天', '刚过去的那天', 'time2:yesterday'],
      ['when', '什么时候', '问时间的疑问词', 'word:question'],
      ['over', '在……期间', '越过头顶的上方', 'word:over'],
      ['ago', '以前', '很久很久之前', 'time2:ago'],
      ['slept', '睡觉了', '睡了的过去式', 'time2:slept'],
      ['January', '一月', '新年的第一个月', 'time2:month:1'],
      ['February', '二月', '过年常常在这月', 'time2:month:2'],
      ['March', '三月', '春天发芽的月份', 'time2:month:3'],
      ['April', '四月', '春雨绵绵的月份', 'time2:month:4'],
      ['May', '五月', '劳动节的月份', 'time2:month:5'],
      ['June', '六月', '儿童节的月份', 'time2:month:6'],
      ['July', '七月', '放暑假的月份', 'time2:month:7'],
      ['August', '八月', '蝉鸣的暑假', 'time2:month:8'],
      ['September', '九月', '开学的月份', 'time2:month:9'],
      ['October', '十月', '国庆节的月份', 'time2:month:10'],
      ['November', '十一月', '深秋的月份', 'time2:month:11'],
      ['December', '十二月', '一年的最后一个月', 'time2:month:12'],
      ['Easter', '复活节', '彩蛋和兔子的节日', 'time2:easter'],
      ['Christmas', '圣诞节', '圣诞老人送礼物的节日', 'time2:christmas'],
      ['term', '学期', '上学期或下学期', 'time2:term'],
      ['special', '特别的', '独一无二的', 'word:special'],
    ] },
  { key: 'wordland', name: '奇趣语文岛', emoji: '🔤', color: '#F0E8D8', cx: -45.5, cz: 50.5, r: 20, style: 'mixed',
    rows: [
      ['old', '年长的', '爷爷奶奶的样子', 'word:old'],
      ['young', '年轻的', '爸爸妈妈以前的样子', 'word:young'],
      ['kind', '和蔼的', '笑眯眯帮你的样子', 'word:kind'],
      ['strict', '严格的', '一丝不苟的样子', 'word:strict'],
      ['polite', '有礼貌的', '常说谢谢不客气', 'word:polite'],
      ['hard-working', '勤奋的', '特别特别努力', 'word:hardworking'],
      ['helpful', '乐于助人的', '爱帮别人忙', 'word:helpful'],
      ['clever', '聪明的', '一点就通的小脑瓜', 'word:clever'],
      ['shy', '害羞的', '脸红躲起来的样子', 'word:shy'],
      ['quiet', '安静的', '图书馆里要保持', 'word:quiet'],
      ['strong', '强壮的', '大力士的样子', 'word:strong'],
      ['whose', '谁的', '问东西的主人', 'word:question'],
      ['his', '他的', '男生的', 'word:his'],
      ['her', '她的', '女生的', 'word:her'],
      ['which', '哪一个', '二选一的时候问', 'word:question'],
      ['best', '最好的', '第一名那么好', 'word:best'],
      ['on', '在……上', '小猫在盒子上面', 'word:on'],
      ['in', '在……里', '小猫在盒子里面', 'word:in'],
      ['under', '在……下面', '小猫在盒子下面', 'word:under'],
      ['front', '前面', '排在最前头', 'word:front'],
      ['above', '上方', '头顶上那个方向', 'word:above'],
      ['beside', '旁边', '挨着的那个方向', 'word:beside'],
      ['between', '之间', '两个的中间', 'word:between'],
      ['behind', '后面', '藏在背后的方向', 'word:behind'],
      ['taller', '更高的', '比一比才知道', 'word:taller'],
      ['shorter', '更矮的', '和更高反着来', 'word:shorter'],
      ['stronger', '更强壮的', '力气更大了', 'word:stronger'],
      ['older', '年龄更大的', '年纪更大一些', 'word:older'],
      ['younger', '更年轻的', '年纪更小一些', 'word:younger'],
      ['bigger', '更大的', '块头更大了', 'word:bigger'],
      ['heavier', '更重的', '重量更大了', 'word:heavier'],
      ['longer', '更长的', '长度更长了', 'word:longer'],
      ['thinner', '更瘦的', '变得更瘦了', 'word:thinner'],
      ['smaller', '更小的', '变得更小了', 'word:smaller'],
    ] },
  { key: 'sports', name: '运动公园', emoji: '⚽', color: '#D8EED8', cx: 32.6, cz: 94.6, r: 20, style: 'tree',
    rows: [
      ['dance', '跳舞', '跟着音乐扭一扭', 'doll:dance'],
      ['cook', '烹饪', '在厨房做出好菜', 'doll:cook'],
      ['swim', '游泳', '在水里像小鱼', 'doll:swim'],
      ['singing', '正在唱歌', '唱歌的进行时', 'doll:singing'],
      ['dancing', '正在跳舞', '跳舞的进行时', 'doll:dancing'],
      ['cooking', '正在做饭', '做饭的进行时', 'doll:cooking'],
      ['sleeping', '正在睡觉', '呼呼大睡进行时', 'doll:sleeping'],
      ['running', '正在跑', '跑步的进行时', 'doll:running'],
      ['jumping', '正在跳', '蹦蹦跳进行时', 'doll:jumping'],
      ['playing', '正在玩', '玩耍的进行时', 'doll:playing'],
      ['eating', '正在吃', '吃东西的进行时', 'doll:eating'],
      ['drinking', '正在喝', '喝东西的进行时', 'doll:drinking'],
      ['climbing', '正在攀爬', '往上爬的进行时', 'doll:climbing'],
      ['quietly', '安静地', '轻轻的没有声音', 'word:quietly'],
      ['loudly', '大声地', '放开嗓门的样子', 'word:loudly'],
      ['hobby', '爱好', '空闲最爱做的事', 'word:hobby'],
      ['cycling', '骑自行车运动', '骑车兜风', 'doll:cycling'],
      ['ice-skate', '滑冰', '冰上跳舞', 'doll:iceskate'],
      ['badminton', '羽毛球运动', '球拍加羽毛球', 'word:badminton'],
    ] },
  { key: 'nature', name: '自然风景岛', emoji: '⛰️', color: '#D8E8D0', cx: 92.1, cz: 33.5, r: 17, style: 'pine',
    rows: [
      ['forest', '森林', '很多很多树组成', 'nature:forest'],
      ['river', '河流', '流动的水', 'nature:river'],
      ['lake', '湖泊', '大片的静水', 'nature:lake'],
      ['mountain', '高山', '又高又大的山', 'nature:mountain'],
      ['hill', '小山', '矮一点的山', 'nature:hill'],
      ['farm', '农场', '种养动物的园子', 'place:farm'],
      ['house', '房屋', '住人的小房子', 'place:house'],
      ['village', '村庄', '小房子组成的村子', 'place:village'],
      ['building', '建筑物', '城市里高楼', 'place:building'],
      ['bridge', '桥', '跨过河的路', 'place:bridge'],
    ] },

  // ===== 课本短语岛（8 座，外圈新海域；短语用对话气泡词宠呈现） =====
  { key: "greet", name: "口语问候岛", emoji: "👋", color: "#FBE4D8", cx: 118, cz: 0, r: 11.31, style: "mixed",
    rows: [
      ["bye bye", "拜拜", "口语「拜拜」", "phrase:👋:bye bye"],
      ["good morning", "早上好", "口语「早上好」", "phrase:🌅:good morning"],
      ["good afternoon", "下午好", "口语「下午好」", "phrase:🌤️:good afternoon"],
      ["nice to meet you", "很高兴认识你", "口语「很高兴认识你」", "phrase:🤝:nice to meet you"],
      ["my name is...", "我的名字是……", "口语「我的名字是……」", "phrase:🪪:my name is..."],
      ["happy birthday", "生日快乐", "口语「生日快乐」", "phrase:🎂:happy birthday"],
      ["how old are you", "你几岁了", "口语「你几岁了」", "phrase:🎈:how old are you"],
    ] },
  { key: "campus", name: "校园短语岛", emoji: "🎒", color: "#DCEAF5", cx: -2.1, cz: -118, r: 11, style: "pine",
    rows: [
      ["new friend", "新朋友", "口语「新朋友」", "phrase:🤝:new friend"],
      ["do you like pears", "你喜欢梨吗", "口语「你喜欢梨吗」", "phrase:🍐:do you like pears"],
      ["how many", "多少", "口语「多少」", "phrase:🔢:how many"],
    ] },
  { key: "houseph", name: "居家短语岛", emoji: "🛋️", color: "#F0E4EC", cx: 0, cz: 118, r: 11, style: "house",
    rows: [
      ["pencil box", "铅笔盒", "口语「铅笔盒」", "phrase:✏️:pencil box"],
      ["living room", "客厅", "口语「客厅」", "phrase:🛋️:living room"],
      ["baby brother", "弟弟", "口语「弟弟」", "phrase:👶:baby brother"],
      ["football player", "足球运动员", "口语「足球运动员」", "phrase:⚽:football player"],
    ] },
  { key: "schoolph", name: "时刻短语岛", emoji: "🕒", color: "#E4F0E4", cx: -84.9, cz: -82, r: 14.280000000000001, style: "mixed",
    rows: [
      ["art room", "美术教室", "口语「美术教室」", "phrase:🎨:art room"],
      ["computer room", "计算机教室", "口语「计算机教室」", "phrase:💻:computer room"],
      ["music room", "音乐教室", "口语「音乐教室」", "phrase:🎵:music room"],
      ["next to", "紧邻", "口语「紧邻」", "phrase:↔️:next to"],
      ["English class", "英语课", "口语「英语课」", "phrase:🔤:English class"],
      ["music class", "音乐课", "口语「音乐课」", "phrase:🎶:music class"],
      ["PE class", "体育课", "口语「体育课」", "phrase:🏃:PE class"],
      ["get up", "起床", "口语「起床」", "phrase:⏰:get up"],
      ["go to school", "去上学", "口语「去上学」", "phrase:🎒:go to school"],
      ["go home", "回家", "口语「回家」", "phrase:🏠:go home"],
      ["go to bed", "上床睡觉", "口语「上床睡觉」", "phrase:🛏️:go to bed"],
      ["just a minute", "稍等一会儿", "口语「稍等一会儿」", "phrase:⏳:just a minute"],
      ["green beans", "青豆", "口语「青豆」", "phrase:🫛:green beans"],
      ["try on", "试穿", "口语「试穿」", "phrase:👗:try on"],
      ["how much", "多少钱", "口语「多少钱」", "phrase:💰:how much"],
      ["all right", "好吧", "口语「好吧」", "phrase:👌:all right"],
    ] },
  { key: "weekph", name: "星期短语岛", emoji: "📅", color: "#F5EEDC", cx: -117.8, cz: 6.2, r: 13.29, style: "house",
    rows: [
      ["wash my clothes", "洗衣服", "口语「洗衣服」", "phrase:🧺:wash my clothes"],
      ["watch TV", "看电视", "口语「看电视」", "phrase:📺:watch TV"],
      ["do homework", "做作业", "口语「做作业」", "phrase:📝:do homework"],
      ["read books", "读书", "口语「读书」", "phrase:📚:read books"],
      ["ice cream", "冰激凌", "口语「冰激凌」", "phrase:🍦:ice cream"],
      ["would like", "想要", "口语「想要」", "phrase:🙋:would like"],
      ["sing English songs", "唱英文歌", "口语「唱英文歌」", "phrase:🎤:sing English songs"],
      ["play the pipa", "弹琵琶", "口语「弹琵琶」", "phrase:🪕:play the pipa"],
      ["do kung fu", "练武术", "口语「练武术」", "phrase:🥋:do kung fu"],
      ["draw cartoons", "画漫画", "口语「画漫画」", "phrase:🎨:draw cartoons"],
      ["play basketball", "打篮球", "口语「打篮球」", "phrase:🏀:play basketball"],
      ["play ping-pong", "打乒乓球", "口语「打乒乓球」", "phrase:🏓:play ping-pong"],
      ["speak English", "说英语", "口语「说英语」", "phrase:🗣️:speak English"],
    ] },
  { key: "actph", name: "活动短语岛", emoji: "🎪", color: "#F5E0E8", cx: 86.3, cz: 80.5, r: 16.92, style: "mixed",
    rows: [
      ["do morning exercises", "做早操", "口语「做早操」", "phrase:🤸:do morning exercises"],
      ["eat breakfast", "吃早饭", "口语「吃早饭」", "phrase:🥣:eat breakfast"],
      ["have class", "上课", "口语「上课」", "phrase:🏫:have class"],
      ["play sports", "进行体育运动", "口语「进行体育运动」", "phrase:⚽:play sports"],
      ["eat dinner", "吃晚饭", "口语「吃晚饭」", "phrase:🍽️:eat dinner"],
      ["clean my room", "打扫房间", "口语「打扫房间」", "phrase:🧹:clean my room"],
      ["go for a walk", "散步", "口语「散步」", "phrase:🚶:go for a walk"],
      ["go shopping", "去购物", "口语「去购物」", "phrase:🛒:go shopping"],
      ["take a dancing class", "上舞蹈课", "口语「上舞蹈课」", "phrase:💃:take a dancing class"],
      ["pick apples", "摘苹果", "口语「摘苹果」", "phrase:🍎:pick apples"],
      ["make a snowman", "堆雪人", "口语「堆雪人」", "phrase:⛄:make a snowman"],
      ["go swimming", "去游泳", "口语「去游泳」", "phrase:🏊:go swimming"],
      ["April Fool's Day", "愚人节", "口语「愚人节」", "phrase:🤡:April Fool's Day"],
      ["Mother's Day", "母亲节", "口语「母亲节」", "phrase:💐:Mother's Day"],
      ["Father's Day", "父亲节", "口语「父亲节」", "phrase:👔:Father's Day"],
      ["Children's Day", "儿童节", "口语「儿童节」", "phrase:🎈:Children's Day"],
      ["Teachers' Day", "教师节", "口语「教师节」", "phrase:🍎:Teachers' Day"],
      ["National Day", "国庆节", "口语「国庆节」", "phrase:🇨🇳:National Day"],
      ["playing with each other", "互相玩耍", "口语「互相玩耍」", "phrase:🤝:playing with each other"],
      ["doing the dishes", "正在洗碗", "口语「正在洗碗」", "phrase:🍽️:doing the dishes"],
      ["cleaning the room", "正在打扫房间", "口语「正在打扫房间」", "phrase:🧹:cleaning the room"],
      ["reading a book", "正在读书", "口语「正在读书」", "phrase:📖:reading a book"],
      ["having a class", "正在上课", "口语「正在上课」", "phrase:🏫:having a class"],
      ["eating lunch", "正在吃午饭", "口语「正在吃午饭」", "phrase:🍱:eating lunch"],
    ] },
  { key: "travelph", name: "出行短语岛", emoji: "🧭", color: "#DCE8F5", cx: -82, cz: 84.9, r: 19, style: "house",
    rows: [
      ["science museum", "科学博物馆", "口语「科学博物馆」", "phrase:🔬:science museum"],
      ["post office", "邮局", "口语「邮局」", "phrase:📮:post office"],
      ["turn left", "向左转", "口语「向左转」", "phrase:⬅️:turn left"],
      ["turn right", "向右转", "口语「向右转」", "phrase:➡️:turn right"],
      ["go straight", "直走", "口语「直走」", "phrase:⬆️:go straight"],
      ["on foot", "步行", "口语「步行」", "phrase:🚶:on foot"],
      ["by bus", "乘公交车", "口语「乘公交车」", "phrase:🚌:by bus"],
      ["by plane", "乘飞机", "口语「乘飞机」", "phrase:✈️:by plane"],
      ["by taxi", "乘出租车", "口语「乘出租车」", "phrase:🚕:by taxi"],
      ["by ship", "乘轮船", "口语「乘轮船」", "phrase:🚢:by ship"],
      ["by subway", "乘地铁", "口语「乘地铁」", "phrase:🚇:by subway"],
      ["by train", "乘火车", "口语「乘火车」", "phrase:🚆:by train"],
      ["slow down", "减速", "口语「减速」", "phrase:🐢:slow down"],
      ["traffic lights", "交通信号灯", "口语「交通信号灯」", "phrase:🚦:traffic lights"],
      ["visit my grandparents", "看望祖父母", "口语「看望祖父母」", "phrase:👵:visit my grandparents"],
      ["see a film", "看电影", "口语「看电影」", "phrase:🎬:see a film"],
      ["take a trip", "去旅行", "口语「去旅行」", "phrase:🧳:take a trip"],
      ["next week", "下周", "口语「下周」", "phrase:📅:next week"],
      ["comic book", "漫画书", "口语「漫画书」", "phrase:📕:comic book"],
      ["pen pal", "笔友", "口语「笔友」", "phrase:✉️:pen pal"],
      ["doing kung fu", "练武术", "口语「练武术」", "phrase:🥋:doing kung fu"],
      ["reading stories", "读故事", "口语「读故事」", "phrase:📖:reading stories"],
      ["studies Chinese", "学中文", "口语「学中文」", "phrase:📖:studies Chinese"],
      ["goes hiking", "去远足", "口语「去远足」", "phrase:🥾:goes hiking"],
      ["factory worker", "工厂工人", "口语「工厂工人」", "phrase:🏭:factory worker"],
      ["police officer", "警察", "口语「警察」", "phrase:👮:police officer"],
      ["head teacher", "校长", "口语「校长」", "phrase:👩‍🏫:head teacher"],
      ["see a doctor", "看病", "口语「看病」", "phrase:🩺:see a doctor"],
      ["wear warm clothes", "穿暖和的衣服", "口语「穿暖和的衣服」", "phrase:🧥:wear warm clothes"],
      ["take a deep breath", "深吸一口气", "口语「深吸一口气」", "phrase:🌬️:take a deep breath"],
      ["count to ten", "数到十", "口语「数到十」", "phrase:🔢:count to ten"],
    ] },
  { key: "pastph", name: "往事短语岛", emoji: "🕰️", color: "#E8E0F0", cx: 80.5, cz: -86.3, r: 14.940000000000001, style: "house",
    rows: [
      ["cleaned my room", "打扫了房间", "口语「打扫了房间」", "phrase:🧹:cleaned my room"],
      ["washed my clothes", "洗了衣服", "口语「洗了衣服」", "phrase:🧺:washed my clothes"],
      ["stayed at home", "待在家里", "口语「待在家里」", "phrase:🏠:stayed at home"],
      ["watched TV", "看了电视", "口语「看了电视」", "phrase:📺:watched TV"],
      ["read a book", "读了书", "口语「读了书」", "phrase:📖:read a book"],
      ["saw a film", "看了电影", "口语「看了电影」", "phrase:🎬:saw a film"],
      ["had a cold", "感冒了", "口语「感冒了」", "phrase:🤒:had a cold"],
      ["last weekend", "上周末", "口语「上周末」", "phrase:🗓️:last weekend"],
      ["went fishing", "去钓鱼", "口语「去钓鱼」", "phrase:🎣:went fishing"],
      ["went camping", "去野营", "口语「去野营」", "phrase:🏕️:went camping"],
      ["went swimming", "去游泳", "口语「去游泳」", "phrase:🏊:went swimming"],
      ["rode a bike", "骑自行车", "口语「骑自行车」", "phrase:🚲:rode a bike"],
      ["rode a horse", "骑马", "口语「骑马」", "phrase:🐴:rode a horse"],
      ["hurt my foot", "伤了我的脚", "口语「伤了我的脚」", "phrase:🦶:hurt my foot"],
      ["took pictures", "拍照", "口语「拍照」", "phrase:📷:took pictures"],
      ["bought gifts", "买礼物", "口语「买礼物」", "phrase:🎁:bought gifts"],
      ["dining hall", "餐厅", "口语「餐厅」", "phrase:🍽️:dining hall"],
      ["look up", "查阅", "口语「查阅」", "phrase:🔍:look up"],
    ] },
  ...EXTRA_ISLANDS,
];

// ================= 自动展开 =================
// 撇号转成连字符，避免 we'll / well 这类归一化后撞 id
const idOf = en => en.toLowerCase().replace(/[’']/g, '-').replace(/[^a-z0-9-]/g, '');
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

// 岛上单词沿黄金角螺旋散布，位置自动生成
function spiralPos(i, n, cx, cz, R) {
  const a = i * GOLDEN + 0.7;
  const rr = Math.sqrt((i + 0.5) / n) * (R - 3.2);
  return [cx + Math.cos(a) * rr, cz + Math.sin(a) * rr];
}

const isPhrase = en => /\s/.test(en.trim());

const islandWords = [];
for (const isl of ISLANDS) {
  isl.startIndex = islandWords.length;
  isl.rows.forEach(([en, zh, hint, spec], i) => {
    const [x, z] = spiralPos(i, isl.rows.length, isl.cx, isl.cz, isl.r);
    // 短语与单词共用一个词表：短语 id 加 ph- 前缀，避免与同名单词撞车（如 ice cream / icecream）
    const phrase = isPhrase(en);
    const id = phrase ? `ph-${idOf(en)}` : idOf(en);
    const icon = phrase ? (String(spec).split(':')[1] || '💬') : null;
    islandWords.push({
      id, en, zh,
      syl: phrase ? en.trim().split(/\s+/) : [en],
      hint,
      pet: id,
      pos: [Math.round(x * 10) / 10, Math.round(z * 10) / 10],
      zone: isl.key,
      island: isl.key,
      phrase,
      icon,
      spec,
      story: phrase
        ? `${isl.emoji} 一句常用口语住在这里，跟着它大声读出来吧！`
        : `${isl.emoji} ${isl.name}的小居民，天天盼着和你一起玩。`,
    });
  });
}

// ================= 分册（年级·上下册）归类 =================
// 每个海岛词标注它出自哪一册（来自 curriculum.js 的课本单元），
// 每座海岛标注它覆盖的册；这样选了三上就只看三上，不会把八册揉到一起。
const BOOK_LABELS = { '3a': '三上', '3b': '三下', '4a': '四上', '4b': '四下', '5a': '五上', '5b': '五下', '6a': '六上', '6b': '六下' };
const en2sem = new Map();
for (const [sem, book] of Object.entries(CURRICULUM))
  for (const unit of book.units)
    for (const item of unit.words) {
      const en = item.split('|')[0].toLowerCase();
      if (!en2sem.has(en)) en2sem.set(en, []);
      if (!en2sem.get(en).includes(sem)) en2sem.get(en).push(sem);
    }
const volsOf = en => en2sem.get(en.toLowerCase()) || [];

// 老词（农场/海滩/森林）作为固定序章永远保留；顺带记下它属于哪几册（可能为空）
for (const w of BASE_WORDS) { w.vols = volsOf(w.en); }   // 注意：别覆盖 w.story，那是每只词宠的小知识文案
for (const w of islandWords) w.vols = volsOf(w.en);
for (const isl of ISLANDS) isl.vols = [...new Set(isl.rows.flatMap(r => volsOf(r[0])))];

// 对外导出完整词表（老词 + 海岛词）
export const WORDS = [...BASE_WORDS, ...islandWords];
const ALL_WORDS = WORDS;
export const WORD_MAP = Object.fromEntries(ALL_WORDS.map(w => [w.id, w]));
export const TOTAL = ALL_WORDS.length;

// 关卡：每 6 词一关
export const PER_CHAPTER = 6;
// 序章：农场/海滩/森林 60 词（含 boat/light/wind/seed/rain 剧情钥匙），每册都从它开始
export const PROLOGUE = BASE_WORDS;
export const PROLOGUE_CHAPTERS = Math.ceil(BASE_WORDS.length / PER_CHAPTER);
export const SEM_KEYS = Object.keys(CURRICULUM);
export const BOOK_LABEL = sem => (CURRICULUM[sem] && CURRICULUM[sem].name) || BOOK_LABELS[sem] || sem;   // 全称：如「四年级上册」（界面不用简写）
// 区域中文名（主岛 + 海岛一起查）
export const ZONE_NAMES = {
  meadow: '出生草甸', orchard: '阳光果园', windmill: '风车田',
  barnyard: '谷仓前院', barn: '谷仓里', garden: '魔法菜园', sky: '天空岛',
  beach: '阳光海滩', forest: '神秘森林',
  ...Object.fromEntries(ISLANDS.map(i => [i.key, i.name])),
};
// 关卡名：整关在同一岛就叫岛名，跨岛用前一个词所在区域名
function wordsZoneName(ids) {
  const w = WORD_MAP[ids[0]];
  if (w.island) return ISLANDS.find(i => i.key === w.island)?.name || w.zone;
  return ZONE_NAMES[w.zone] || w.zone;
}

// 本册海岛词（按词表顺序，一个词出现在多册就多册都算）
export function wordsForSem(sem) { return islandWords.filter(w => w.vols.includes(sem)); }
// 本册可玩词表 = 固定序章 + 本册课本词
export function allWordsForSem(sem) { return [...BASE_WORDS, ...wordsForSem(sem)]; }
// 本册关卡（动态组关）：每关 6 个新词（单词+短语混合）+ 6 个复习词（之前关学过，seed 稳定跨会话一致）。
// 城市链条一关一城：words 附带 review 数组标记复习蛋（简单模式：读一遍就过）。
function makeRand(seedStr) {
  let h = 2166136261;
  for (const ch of String(seedStr)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
}
function seededShuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// 供 game.js 奖励城市组关复用的 seeded 工具
export const makeSeedRand = makeRand;
export const shuffleSeed = seededShuffle;
export function chaptersFor(sem, username = '') {
  const rand = makeRand((username || '') + '|' + sem);
  const pool = seededShuffle(allWordsForSem(sem).map(w => w.id), rand);
  const chapters = [];
  const learned = [];
  let i = 0;
  while (i < pool.length) {
    const fresh = pool.slice(i, i + 6);
    i += 6;
    let review;
    if (learned.length >= 6) {
      // 复习词：从之前关学过的词里 seeded 抽 6 个
      const bag = seededShuffle(learned, makeRand((username || '') + '|' + sem + '#' + chapters.length));
      review = bag.slice(0, 6);
    } else {
      // 开头没有旧词可复习：多学 6 个新词垫满一关
      review = pool.slice(i, i + 6);
      i += 6;
    }
    const words = [...fresh, ...review];
    chapters.push({ name: wordsZoneName(fresh), words, review });
    learned.push(...fresh);
  }
  return chapters;
}

// 本册海岛（带 startChapter：序章占掉前面的关，之后按本册词序解锁）
export function islandsForSem(sem) {
  const ws = wordsForSem(sem);
  const pos = new Map(ws.map((w, i) => [w.id, i]));
  const wid = en => (isPhrase(en) ? 'ph-' : '') + idOf(en);
  return ISLANDS.filter(isl => isl.vols.includes(sem)).map(isl => {
    const first = isl.rows.map(r => wid(r[0])).find(id => pos.has(id));
    const p = first != null ? pos.get(first) : 0;
    return { ...isl, startChapter: PROLOGUE_CHAPTERS + Math.floor(p / PER_CHAPTER) };
  });
}

// 岛上词宠的参数化模型配方（models.js 的 buildPet 读取）
export const AUTO_SPECS = Object.fromEntries(islandWords.map(w => [w.id, w.spec]));

// 单词当前的岛（主岛词返回 null）
export function islandOfZone(zone) {
  return ISLANDS.find(i => i.key === zone) || null;
}

// 喂养复习的遗忘曲线（毫秒）
export const FEED_INTERVALS = [10 * 60e3, 1 * 864e5, 3 * 864e5, 7 * 864e5, 14 * 864e5];
