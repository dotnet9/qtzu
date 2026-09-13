// Q淘族 · 课程库（参考人教版 PEP 3-6 年级核心词汇与常用表达，可在本文件直接增删）
// 格式：'单词或短语|中文'，单词/短语都会生成语音并支持跟读评分

const U = (name, words) => ({ name, words });
const S = (name, units) => ({ name, units });

export const CURRICULUM = {
  '3a': S('三年级上册', [
    U('Unit 1 Hello!', ['hello|你好', 'hi|嗨', 'goodbye|再见', 'bye bye|拜拜', 'good morning|早上好', 'good afternoon|下午好', 'nice to meet you|很高兴认识你', 'my name is...|我的名字是……']),
    U('Unit 2 Colours', ['red|红色', 'yellow|黄色', 'green|绿色', 'blue|蓝色', 'black|黑色', 'white|白色', 'orange|橙色', 'brown|棕色']),
    U('Unit 3 Look at me!', ['face|脸', 'ear|耳朵', 'eye|眼睛', 'nose|鼻子', 'mouth|嘴巴', 'arm|手臂', 'hand|手', 'head|头', 'body|身体', 'leg|腿']),
    U('Unit 4 We love animals', ['cat|猫', 'dog|狗', 'duck|鸭子', 'panda|熊猫', 'monkey|猴子', 'bird|鸟', 'tiger|老虎', 'elephant|大象', 'zoo|动物园', 'funny|有趣的']),
    U('Unit 5 Let\'s eat!', ['bread|面包', 'juice|果汁', 'egg|鸡蛋', 'milk|牛奶', 'water|水', 'fish|鱼', 'rice|米饭', 'cake|蛋糕', 'hamburger|汉堡包']),
    U('Unit 6 Happy birthday', ['one|一', 'two|二', 'three|三', 'four|四', 'five|五', 'six|六', 'seven|七', 'eight|八', 'nine|九', 'ten|十', 'happy birthday|生日快乐', 'how old are you|你几岁了']),
    U('拓展词汇·单词', ['can|可以', 'share|分享', 'smile|微笑', 'listen|听', 'help|帮助', 'say|说', 'and|和', 'good|好的', 'mum|妈妈', 'dad|爸爸', 'grandma|奶奶', 'grandpa|爷爷', 'me|我', 'have|有', 'cousin|堂表兄妹', 'baby|婴儿', 'some|一些', 'like|喜欢', 'pet|宠物', 'rabbit|兔子', 'go|去', 'fox|狐狸', 'Miss|女士', 'cute|可爱的', 'lion|狮子', 'fast|快的', 'air|空气', 'school|学校', 'need|需要', 'flower|花', 'new|新的', 'sun|太阳', 'give|给', 'us|我们', 'them|他们', 'colour|颜色', 'make|制作', 'purple|紫色', 'bear|熊', 'sea|海洋', 'pink|粉色', 'draw|画', 'year|年', 'o\'clock|点钟', 'cut|切', 'piece|块', 'eat|吃']),
    U('拓展词汇·短语', ['red panda|小熊猫', 'point to your ear|指你的耳朵', 'wave your hand|挥挥手', 'what\'s your name|你叫什么名字', 'my name\'s|我叫……', 'show me your pencil|给我看看你的铅笔']),
  ]),
  '3b': S('三年级下册', [
    U('Unit 1 Welcome back to school!', ['UK|英国', 'Canada|加拿大', 'USA|美国', 'China|中国', 'student|学生', 'teacher|老师', 'boy|男孩', 'girl|女孩', 'new friend|新朋友']),
    U('Unit 2 My family', ['father|爸爸', 'mother|妈妈', 'man|男人', 'woman|女人', 'grandmother|奶奶', 'grandfather|爷爷', 'sister|姐妹', 'brother|兄弟', 'family|家庭']),
    U('Unit 3 At the zoo', ['giraffe|长颈鹿', 'tall|高的', 'short|矮的', 'fat|胖的', 'thin|瘦的', 'long|长的', 'small|小的', 'big|大的', 'animal|动物']),
    U('Unit 4 Where is my car?', ['on|在……上', 'in|在……里', 'under|在……下面', 'desk|书桌', 'chair|椅子', 'cap|帽子', 'ball|球', 'car|小汽车', 'toy|玩具']),
    U('Unit 5 Do you like pears?', ['pear|梨', 'apple|苹果', 'orange|橙子', 'banana|香蕉', 'watermelon|西瓜', 'grape|葡萄', 'fruit|水果', 'do you like pears|你喜欢梨吗']),
    U('Unit 6 How many?', ['eleven|十一', 'twelve|十二', 'thirteen|十三', 'fourteen|十四', 'fifteen|十五', 'sixteen|十六', 'seventeen|十七', 'eighteen|十八', 'nineteen|十九', 'twenty|二十', 'how many|多少']),
    U('拓展词汇·单词', ['she|她', 'he|他', 'welcome|欢迎', 'today|今天', 'from|来自', 'pupil|小学生', 'tired|累的', 'feel|感觉', 'love|爱', 'want|要', 'drink|喝', 'sleep|睡觉', 'play|玩', 'bag|书包', 'read|读', 'write|写', 'storybook|故事书', 'speak|说', 'hungry|饿的', 'boat|小船', 'kite|风筝', 'doll|洋娃娃', 'box|盒子', 'plane|飞机', 'train|火车', 'time|时间', 'yuan|元', 'many|许多', 'people|人']),
    U('拓展词汇·短语', ['be from|来自', 'a new student|一名新学生', 'feel happy|感到开心', 'like dogs|喜欢狗', 'write a word|写字', 'healthy food|健康食物', 'toy box|玩具盒', 'on the desk|在书桌上', 'what time|几点']),
  ]),
  '4a': S('四年级上册', [
    U('Unit 1 My classroom', ['classroom|教室', 'window|窗户', 'blackboard|黑板', 'light|灯', 'picture|图画', 'door|门', 'computer|计算机', 'wall|墙壁', 'floor|地板']),
    U('Unit 2 My schoolbag', ['schoolbag|书包', 'book|书', 'pencil|铅笔', 'pen|钢笔', 'ruler|尺子', 'eraser|橡皮', 'pencil box|铅笔盒', 'candy|糖果', 'notebook|笔记本', 'toy|玩具']),
    U('Unit 3 My friends', ['friend|朋友', 'boy|男孩', 'girl|女孩', 'hair|头发', 'strong|强壮的', 'quiet|安静的', 'glasses|眼镜', 'shoe|鞋子', 'his|他的', 'her|她的']),
    U('Unit 4 My home', ['bedroom|卧室', 'living room|客厅', 'study|书房', 'kitchen|厨房', 'bathroom|浴室', 'bed|床', 'phone|电话', 'table|桌子', 'sofa|沙发', 'fridge|冰箱']),
    U('Unit 5 Dinner\'s ready', ['beef|牛肉', 'chicken|鸡肉', 'noodles|面条', 'soup|汤', 'vegetable|蔬菜', 'chopsticks|筷子', 'bowl|碗', 'fork|叉子', 'knife|刀', 'spoon|勺子']),
    U('Unit 6 Meet my family!', ['parents|父母', 'uncle|叔叔', 'aunt|姑姑', 'baby brother|弟弟', 'doctor|医生', 'driver|司机', 'farmer|农民', 'nurse|护士', 'football player|足球运动员', 'job|工作']),
    U('拓展词汇·单词', ['fan|风扇', 'really|真的', 'clean|打扫', 'TV|电视', 'key|钥匙', 'wow|哇', 'lost|丢失', 'friendly|友好的', 'or|或者', 'right|右边', 'find|找到', 'ready|准备好', 'pass|递', 'try|尝试', 'but|但是', 'little|小的', 'puppy|小狗', 'basketball|篮球']),
    U('拓展词汇·短语', ['teacher\'s desk|讲台', 'maths book|数学书', 'English book|英语书', 'Chinese book|语文书', 'so much|非常', 'help yourself|请自便', 'open the door|开门', 'sweep the floor|扫地', 'turn on the light|开灯', 'put up the picture|张贴图画', 'clean the board|擦黑板', 'close the window|关窗户', 'have a snack|吃零食', 'have a nap|打个盹', 'make a salad|做沙拉', 'pass me the bowl|把碗递给我', 'pass me the knife|把刀递给我', 'cut the vegetables|切蔬菜', 'use the spoon|用勺子', 'use the fork|用叉子']),
  ]),
  '4b': S('四年级下册', [
    U('Unit 1 My school', ['playground|操场', 'garden|花园', 'library|图书馆', 'art room|美术教室', 'computer room|计算机教室', 'music room|音乐教室', 'next to|紧邻', 'homework|作业', 'class|班级', 'forty|四十']),
    U('Unit 2 What time is it?', ['breakfast|早餐', 'lunch|午餐', 'dinner|晚餐', 'English class|英语课', 'music class|音乐课', 'PE class|体育课', 'get up|起床', 'go to school|去上学', 'go home|回家', 'go to bed|上床睡觉', 'just a minute|稍等一会儿']),
    U('Unit 3 Weather', ['cold|寒冷的', 'cool|凉爽的', 'warm|温暖的', 'hot|炎热的', 'sunny|晴朗的', 'windy|有风的', 'cloudy|多云的', 'snowy|下雪的', 'rainy|下雨的', 'weather|天气']),
    U('Unit 4 At the farm', ['tomato|西红柿', 'potato|土豆', 'green beans|青豆', 'carrot|胡萝卜', 'horse|马', 'cow|奶牛', 'sheep|绵羊', 'hen|母鸡', 'farm|农场', 'these|这些']),
    U('Unit 5 My clothes', ['hat|帽子', 'sunglasses|太阳镜', 'scarf|围巾', 'gloves|手套', 'umbrella|雨伞', 'coat|外套', 'sweater|毛衣', 'jacket|夹克', 'shirt|衬衫', 'whose|谁的']),
    U('Unit 6 Shopping', ['expensive|昂贵的', 'cheap|便宜的', 'nice|好看的', 'pretty|美观的', 'size|尺码', 'try on|试穿', 'how much|多少钱', 'sale|特价', 'all right|好吧']),
    U('拓展词汇·单词', ['way|方向', 'now|现在', 'kid|小孩', 'thirty|三十', 'hurry|快点', 'outside|在户外', 'degree|度', 'world|世界', 'London|伦敦', 'Moscow|莫斯科', 'Singapore|新加坡', 'Sydney|悉尼', 'fly|放风筝', 'yum|味道好', 'those|那些', 'goat|山羊', 'clothes|衣服', 'pants|裤子', 'dress|连衣裙', 'skirt|裙子', 'sock|短袜', 'shorts|短裤', 'yours|你的', 'mine|我的', 'pack|收拾行李', 'wait|等待', 'glove|手套', 'too|太']),
    U('拓展词汇·短语', ['first floor|一楼', 'second floor|二楼', 'teacher\'s office|教师办公室', 'hurry up|快点', 'come on|加油', 'be careful|小心', 'how about|怎么样', 'New York|纽约', 'of course|当然']),
  ]),
  '5a': S('五年级上册', [
    U('Unit 1 What\'s he like?', ['old|年长的', 'young|年轻的', 'funny|滑稽的', 'kind|和蔼的', 'strict|严格的', 'polite|有礼貌的', 'hard-working|勤奋的', 'helpful|乐于助人的', 'clever|聪明的', 'shy|害羞的']),
    U('Unit 2 My week', ['Monday|星期一', 'Tuesday|星期二', 'Wednesday|星期三', 'Thursday|星期四', 'Friday|星期五', 'Saturday|星期六', 'Sunday|星期日', 'weekend|周末', 'wash my clothes|洗衣服', 'watch TV|看电视', 'do homework|做作业', 'read books|读书']),
    U('Unit 3 What would you like?', ['sandwich|三明治', 'salad|沙拉', 'hamburger|汉堡包', 'ice cream|冰激凌', 'tea|茶', 'fresh|新鲜的', 'healthy|健康的', 'delicious|美味的', 'hot|辣的', 'sweet|甜的', 'would like|想要']),
    U('Unit 4 What can you do?', ['sing English songs|唱英文歌', 'play the pipa|弹琵琶', 'do kung fu|练武术', 'dance|跳舞', 'draw cartoons|画漫画', 'cook|烹饪', 'swim|游泳', 'play basketball|打篮球', 'play ping-pong|打乒乓球', 'speak English|说英语']),
    U('Unit 5 There is a big bed', ['clock|时钟', 'plant|植物', 'bottle|瓶子', 'bike|自行车', 'photo|照片', 'front|前面', 'above|上方', 'beside|旁边', 'between|之间', 'behind|后面']),
    U('Unit 6 In a nature park', ['forest|森林', 'river|河流', 'lake|湖泊', 'mountain|高山', 'hill|小山', 'tree|树', 'village|村庄', 'house|房屋', 'bridge|桥', 'building|建筑物']),
    U('拓展词汇·单词', ['know|知道', 'our|我们的', 'Ms|女士', 'will|将要', 'sometime|有时', 'robot|机器人', 'him|他', 'finish|完成', 'wash|洗', 'watch|看', 'often|经常', 'park|公园', 'sport|运动', 'should|应该', 'every|每个', 'day|天', 'schedule|日程', 'thirsty|渴的', 'favourite|最喜爱的', 'food|食物', 'dear|亲爱的', 'onion|洋葱', 'sing|唱歌', 'song|歌曲', 'cartoon|漫画', 'ping-pong|乒乓球', 'party|聚会', 'next|下一个', 'wonderful|极好的', 'learn|学习', 'any|任何', 'problem|问题', 'send|发送', 'email|电子邮件', 'we\'ll|将会', 'there|那里', 'grandparent|祖父母', 'their|他们的', 'lot|大量', 'move|搬家', 'dirty|脏的', 'everywhere|到处', 'mouse|老鼠', 'live|居住', 'nature|自然', 'boating|划船', 'high|高的']),
    U('拓展词汇·短语', ['play football|踢足球', 'play sport|做运动', 'kung fu|功夫', 'no problem|没问题', 'water bottle|水瓶', 'in front of|在……前面', 'lots of|大量', 'go boating|去划船']),
  ]),
  '5b': S('五年级下册', [
    U('Unit 1 My day', ['do morning exercises|做早操', 'eat breakfast|吃早饭', 'have class|上课', 'play sports|进行体育运动', 'eat dinner|吃晚饭', 'clean my room|打扫房间', 'go for a walk|散步', 'go shopping|去购物', 'take a dancing class|上舞蹈课', 'when|什么时候']),
    U('Unit 2 My favourite season', ['spring|春天', 'summer|夏天', 'autumn|秋天', 'winter|冬天', 'season|季节', 'picnic|野餐', 'pick apples|摘苹果', 'make a snowman|堆雪人', 'go swimming|去游泳', 'which|哪一个', 'best|最']),
    U('Unit 3 My school calendar', ['January|一月', 'February|二月', 'March|三月', 'April|四月', 'May|五月', 'June|六月', 'July|七月', 'August|八月', 'September|九月', 'October|十月', 'November|十一月', 'December|十二月']),
    U('Unit 4 When is the art show?', ['April Fool\'s Day|愚人节', 'Easter|复活节', 'Mother\'s Day|母亲节', 'Father\'s Day|父亲节', 'Children\'s Day|儿童节', 'Teachers\' Day|教师节', 'National Day|国庆节', 'Christmas|圣诞节', 'term|学期', 'special|特别的']),
    U('Unit 5 Whose dog is it?', ['playing|正在玩', 'jumping|正在跳', 'eating|正在吃', 'drinking|正在喝', 'sleeping|正在睡觉', 'running|正在跑', 'climbing|正在攀爬', 'playing with each other|互相玩耍']),
    U('Unit 6 Work quickly!', ['doing the dishes|正在洗碗', 'cleaning the room|正在打扫房间', 'reading a book|正在读书', 'having a class|正在上课', 'eating lunch|正在吃午饭', 'quietly|安静地', 'loudly|大声地']),
    U('拓展词汇·单词', ['after|在……之后', 'start|开始', 'usually|通常', 'Spain|西班牙', 'late|迟到', 'why|为什么', 'shop|购物', 'work|工作', 'last|上一个', 'sound|听起来', 'also|也', 'busy|忙的', 'letter|信', 'for|为了', 'island|岛', 'always|总是', 'cave|山洞', 'win|获胜', 'exercise|运动', 'take|上（课）', 'pick|摘', 'snowman|雪人', 'snow|雪', 'because|因为', 'vacation|假期', 'all|全部', 'lovely|可爱的', 'leaf|叶子', 'fall|落下', 'paint|绘画', 'contest|比赛', 'few|一些', 'thing|事情', 'meet|集会', 'trip|旅行', 'national|国家的', 'American|美国的', 'Thanksgiving|感恩节', 'fool|傻瓜', 'kitten|小猫', 'diary|日记', 'still|仍然', 'noise|噪音', 'fur|软毛', 'open|开着的', 'walk|行走', 'first|第一', 'second|第二', 'third|第三', 'fourth|第四', 'fifth|第五', 'twelfth|第十二', 'twentieth|第二十', 'twenty-first|第二十一', 'hers|她的', 'theirs|他们的', 'ours|我们的', 'each|每个', 'other|其他的', 'excited|兴奋的', 'its|它的', 'show|指引', 'anything|任何事物', 'else|其他', 'exhibition|展览', 'sushi|寿司', 'teach|教', 'Canadian|加拿大的', 'Spanish|西班牙的', 'keep|保持', 'turn|顺序', 'bamboo|竹子']),
    U('拓展词汇·短语', ['go on a picnic|去野餐', 'good job|做得好', 'a few|一些', 'sports meet|运动会', 'Tree Planting Day|植树节', 'the Great Wall|长城', 'each other|互相', 'have a look|看一看', 'keep to the right|靠右', 'keep your desk clean|保持课桌整洁', 'talk quietly|小声说话', 'take turns|按顺序来']),
  ]),
  '6a': S('六年级上册', [
    U('Unit 1 How can I get there?', ['science museum|科学博物馆', 'post office|邮局', 'bookstore|书店', 'cinema|电影院', 'hospital|医院', 'crossing|十字路口', 'turn left|向左转', 'turn right|向右转', 'go straight|直走', 'near|在附近']),
    U('Unit 2 Ways to go to school', ['on foot|步行', 'by bus|乘公交车', 'by plane|乘飞机', 'by taxi|乘出租车', 'by ship|乘轮船', 'by subway|乘地铁', 'by train|乘火车', 'slow down|减速', 'stop|停下', 'traffic lights|交通信号灯']),
    U('Unit 3 My weekend plan', ['visit my grandparents|看望祖父母', 'see a film|看电影', 'take a trip|去旅行', 'tomorrow|明天', 'tonight|今晚', 'next week|下周', 'dictionary|词典', 'comic book|漫画书', 'supermarket|超市']),
    U('Unit 4 I have a pen pal', ['pen pal|笔友', 'hobby|爱好', 'doing kung fu|练武术', 'reading stories|读故事', 'singing|唱歌', 'dancing|跳舞', 'cooking|做饭', 'studies Chinese|学中文', 'goes hiking|去远足']),
    U('Unit 5 What does he do?', ['factory worker|工厂工人', 'postman|邮递员', 'businessman|商人', 'police officer|警察', 'fisherman|渔民', 'scientist|科学家', 'pilot|飞行员', 'coach|教练', 'head teacher|校长', 'reporter|记者']),
    U('Unit 6 How do you feel?', ['angry|生气的', 'afraid|害怕的', 'sad|难过的', 'worried|担心的', 'happy|高兴的', 'see a doctor|看病', 'wear warm clothes|穿暖和的衣服', 'take a deep breath|深吸一口气', 'count to ten|数到十']),
    U('拓展词汇·单词', ['science|科学', 'museum|博物馆', 'left|左边', 'straight|笔直地', 'ask|问', 'sir|先生', 'interesting|有趣的', 'italian|意大利的', 'restaurant|餐馆', 'pizza|比萨', 'street|街道', 'get|到达', 'GPS|定位系统', 'gave|给（过去式）', 'feature|特点', 'follow|跟随', 'far|远的', 'tell|告诉', 'by|乘', 'bus|公交车', 'taxi|出租车', 'ship|轮船', 'subway|地铁', 'slow|慢的', 'down|向下', 'Mrs|夫人', 'early|早的', 'helmet|头盔', 'must|必须', 'wear|穿戴', 'attention|注意', 'traffic|交通', 'Munich|慕尼黑', 'Germany|德国', 'Alaska|阿拉斯加', 'sled|雪橇', 'ferry|轮渡', 'Scotland|苏格兰', 'visit|拜访', 'film|电影', 'evening|晚上', 'comic|滑稽的', 'word|单词', 'postcard|明信片', 'lesson|课', 'space|太空', 'travel|旅行', 'half|一半', 'price|价格', 'together|一起', 'mooncake|月饼', 'poem|诗', 'moon|月亮', 'studies|学习', 'puzzle|谜', 'hiking|远足', 'jasmine|茉莉', 'idea|主意', 'Canberra|堪培拉', 'amazing|惊奇的', 'shall|将要', 'goal|射门', 'join|加入', 'club|俱乐部', 'factory|工厂', 'worker|工人', 'country|国家', 'stay|保持', 'university|大学', 'if|如果', 'use|使用', 'type|打字', 'quickly|快速地', 'secretary|秘书', 'more|更多的', 'deep|深的', 'breath|呼吸', 'count|数数', 'chase|追赶', 'mice|老鼠（复数）', 'bad|坏的', 'hurt|受伤', 'ill|生病的', 'wrong|有毛病', 'well|健康的', 'sit|坐', 'hear|听见', 'ant|蚂蚁', 'worry|担心', 'stuck|陷住', 'mud|泥', 'pull|拉']),
    U('拓展词汇·短语', ['pay attention to|注意', 'word book|单词书', 'Mid-autumn Festival|中秋节', 'get together|聚会', 'have an art lesson|上美术课', 'go to the cinema|去看电影', 'do more exercise|多做运动', 'Papa Westray|帕帕韦斯特雷岛']),
  ]),
  '6b': S('六年级下册', [
    U('Unit 1 How tall are you?', ['taller|更高的', 'shorter|更矮的', 'stronger|更强壮的', 'older|年龄更大的', 'younger|更年轻的', 'bigger|更大的', 'heavier|更重的', 'longer|更长的', 'thinner|更瘦的', 'smaller|更小的']),
    U('Unit 2 Last weekend', ['cleaned my room|打扫了房间', 'washed my clothes|洗了衣服', 'stayed at home|待在家里', 'watched TV|看了电视', 'read a book|读了书', 'saw a film|看了电影', 'had a cold|感冒了', 'slept|睡觉', 'last weekend|上周末', 'yesterday|昨天']),
    U('Unit 3 Where did you go?', ['went fishing|去钓鱼', 'went camping|去野营', 'went swimming|去游泳', 'rode a bike|骑自行车', 'rode a horse|骑马', 'hurt my foot|伤了我的脚', 'took pictures|拍照', 'bought gifts|买礼物', 'over|在……期间', 'mule|骡子']),
    U('Unit 4 Then and now', ['dining hall|餐厅', 'grass|草坪', 'gym|体育馆', 'ago|以前', 'cycling|骑自行车运动', 'ice-skate|滑冰', 'badminton|羽毛球运动', 'star|明星', 'look up|查阅', 'Internet|互联网']),
    U('拓展词汇·单词', ['dinosaur|恐龙', 'hall|大厅', 'metre|米', 'than|比', 'both|两个都', 'kilogram|千克', 'countryside|乡村', 'lower|更低的', 'shadow|影子', 'smarter|更聪明的', 'become|变成', 'cleaned|打扫（过去式）', 'stayed|停留（过去式）', 'washed|洗（过去式）', 'watched|看（过去式）', 'had|有（过去式）', 'saw|看见（过去式）', 'before|在……之前', 'drank|喝（过去式）', 'magazine|杂志', 'better|更好的', 'faster|更快的', 'hotel|旅馆', 'fixed|修理（过去式）', 'broken|破损的', 'lamp|台灯', 'loud|大声的', 'enjoy|享受', 'went|去（过去式）', 'camp|野营', 'fishing|钓鱼', 'rode|骑（过去式）', 'ate|吃（过去式）', 'took|拍（过去式）', 'bought|买（过去式）', 'gift|礼物', 'fell|摔倒（过去式）', 'off|落下', 'Turpan|吐鲁番', 'could|能（过去式）', 'till|直到', 'beach|海滩', 'basket|篮子', 'part|角色', 'licked|舔（过去式）', 'laughed|笑（过去式）', 'easy|容易的', 'different|不同的', 'active|积极的', 'race|赛跑', 'nothing|没有什么', 'thought|想（过去式）', 'felt|感觉（过去式）', 'woke|醒（过去式）', 'cheetah|猎豹', 'dream|梦']),
    U('拓展词汇·短语', ['fell off|摔倒', 'ate fresh food|吃新鲜食物', 'Labour Day|劳动节', 'go cycling|去骑车', 'play badminton|打羽毛球', 'last month|上个月', 'last year|去年']),
  ]),
};

export function gradeKey(grade, term) { return grade + (term === 'up' ? 'a' : 'b'); }
