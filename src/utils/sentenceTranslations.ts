export type Difficulty = 'easy' | 'medium' | 'hard';

const EASY_TRANSLATIONS: Record<string, string> = {
  'Practice makes perfect': 'Luyện tập tạo nên sự hoàn hảo',
  'Keep going one step at a time': 'Hãy tiếp tục từng bước một',
  'Small steps make a big difference': 'Những bước nhỏ tạo nên sự khác biệt lớn',
  'Every day is a fresh start': 'Mỗi ngày là một khởi đầu mới',
  'Learning takes time and patience': 'Học tập cần thời gian và sự kiên nhẫn',
  'Believe in yourself': 'Hãy tin vào chính mình',
  'Stay calm and focused': 'Hãy bình tĩnh và tập trung',
  'Good things take time': 'Những điều tốt đẹp cần thời gian',
  'Dream big and work hard': 'Ước mơ lớn và làm việc chăm chỉ',
  'Enjoy the little moments': 'Hãy tận hưởng những khoảnh khắc nhỏ',
  'Mia found a small garden behind the library': 'Mia tìm thấy một khu vườn nhỏ phía sau thư viện',
  'She planted three seeds and watered them every morning': 'Cô ấy trồng ba hạt giống và tưới chúng mỗi sáng',
  'The first green leaves appeared after a week': 'Những chiếc lá xanh đầu tiên xuất hiện sau một tuần',
  'Mia shared the fresh herbs with her neighbors': 'Mia chia sẻ những loại thảo mộc tươi với hàng xóm',
  'Soon the little garden became a place for everyone': 'Chẳng bao lâu khu vườn nhỏ trở thành nơi cho mọi người',
  'I can build confidence.': 'Tôi có thể xây dựng sự tự tin.',
  'We can make work easier.': 'Chúng ta có thể làm cho công việc dễ dàng hơn.',
  'You can open new doors.': 'Bạn có thể mở ra những cánh cửa mới.',
  'They can bring people closer.': 'Họ có thể khiến mọi người gần gũi hơn.',
  'A good habit can help us stay calm.': 'Một thói quen tốt có thể giúp chúng ta bình tĩnh.',
  'Daily practice can create better habits.': 'Luyện tập hàng ngày có thể tạo ra thói quen tốt hơn.',
  'A short break can help us stay calm.': 'Một khoảng nghỉ ngắn có thể giúp chúng ta bình tĩnh.',
  'Regular reading can make a real difference.': 'Đọc đều đặn có thể tạo ra sự khác biệt thực sự.',
  'The morning sun can brighten the whole morning.': 'Ánh sáng buổi sáng có thể làm sáng cả buổi sáng.',
  'A warm cup of tea can make a busy day feel lighter.': 'Một tách trà ấm có thể làm cho một ngày bận rộn dễ chịu hơn.',
  'One kind message can help us find a new idea.': 'Một tin nhắn tử tế có thể giúp chúng ta tìm ra một ý tưởng mới.',
  'A tidy desk can give us energy for the next task.': 'Một chiếc bàn gọn gàng có thể mang lại năng lượng cho công việc tiếp theo.',
  'The bright window made the small room feel welcoming': 'Cửa sổ sáng làm cho căn phòng nhỏ cảm thấy chào đón',
  'Please place the empty bottle beside the kitchen sink': 'Hãy đặt chai rỗng bên cạnh bồn rửa bát',
  'The helpful guide showed us a quiet path through the park': 'Người hướng dẫn nhiệt tình chỉ cho chúng ta một con đường yên tĩnh qua công viên',
  'A healthy breakfast gives you energy for the morning': 'Bữa sáng lành mạnh mang lại năng lượng cho buổi sáng',
  'The careful driver noticed a narrow bridge ahead': 'Tài xế cẩn thận nhận ra một cây cầu hẹp ở phía trước',
  'We packed a light jacket because the evening might be cool': 'Chúng tôi mang theo áo khoác nhẹ vì buổi tối có thể mát',
  'The local market sells fresh fruit and handmade gifts': 'Chợ địa phương bán trái cây tươi và quà handmade',
  'Her favorite hobby is painting colorful pictures': 'Sở thích yêu thích của cô ấy là vẽ tranh đầy màu sắc',
  'The simple recipe needs flour, eggs, and a little butter': 'Công thức đơn giản cần bột mì, trứng và một chút bơ',
  'A friendly neighbor offered useful advice': 'Một hàng xóm thân thiện đã đưa ra lời khuyên hữu ích',
  'The train arrived at the busy station on time': 'Tàu đến ga đông người đúng giờ',
  'Reading short stories is an enjoyable way to learn': 'Đọc truyện ngắn là cách học thú vị',
};

const MEDIUM_TRANSLATIONS: Record<string, string> = {
  'Practice makes perfect when it comes to language learning': 'Luyện tập tạo nên sự hoàn hảo khi nói đến việc học ngôn ngữ',
  'Technology is best when it brings people together': 'Công nghệ phát huy tối đa khi nó gắn kết mọi người lại với nhau',
  'In the middle of difficulty lies opportunity': 'Trong giữa khó khăn là cơ hội',
  'Life is what happens when you are busy making other plans': 'Cuộc sống là những gì xảy ra khi bạn đang bận làm những kế hoạch khác',
  'The best way to predict the future is to invent it': 'Cách tốt nhất để dự đoán tương lai là sáng tạo ra nó',
  'It does not matter how slowly you go as long as you do not stop': 'Đi chậm bao nhiêu cũng không sao miễn là bạn không dừng lại',
  'You miss one hundred percent of the shots you do not take': 'Bạn bỏ lỡ 100% cơ hội mà bạn không ném ra',
  'The only way to do great work is to love what you do': 'Cách duy nhất để làm việc xuất sắc là yêu thích những gì bạn làm',
  'The journey of a thousand miles begins with one step': 'Hành trình ngàn dặm bắt đầu bằng một bước chân',
  'Opportunities do not happen. You create them': 'Cơ hội không tự đến. Bạn tạo ra chúng',
  'Alex started a new project with a simple plan': 'Alex bắt đầu một dự án mới với một kế hoạch đơn giản',
  'Each morning, the team reviewed one small goal': 'Mỗi sáng, cả đội đều xem xét một mục tiêu nhỏ',
  'Their careful progress revealed problems early': 'Sự tiến bộ cẩn thận của họ phát hiện ra vấn đề sớm',
  'They adjusted the plan and learned from every setback': 'Họ điều chỉnh kế hoạch và học hỏi từ mọi thất bại',
  'After several weeks, the project was ready to share': 'Sau vài tuần, dự án đã sẵn sàng để chia sẻ',
};

const HARD_TRANSLATIONS: Record<string, string> = {
  'The only limit to our realization of tomorrow is our doubts of today': 'Giới hạn duy nhất đối với việc thực hiện ngày mai của chúng ta là sự nghi ngờ của ngày hôm nay',
  'Do not go where the path may lead, go instead where there is no path and leave a trail': 'Đừng đi theo con đường có thể dẫn bạn, hãy đi đến nơi không có đường và để lại dấu vết',
  'To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment': 'Để là chính mình trong một thế giới luôn cố gắng biến bạn thành một thứ khác là thành tựu vĩ đại nhất',
  'I have not failed. I have just found ten thousand ways that will not work': 'Tôi chưa từng thất bại. Tôi chỉ vừa tìm ra mười nghìn cách không thể hoạt động',
  'Whether you think you can or you think you cannot, you are right': 'Dù bạn nghĩ mình có thể hay không thể, bạn đều đúng',
  'Success usually comes to those who are too busy to be looking for it': 'Thành công thường đến với những người quá bận rộn đến mức không cần tìm kiếm nó',
  'Do not be afraid to give up the good to go for the great': 'Đừng sợ từ bỏ điều tốt để theo đuổi điều vĩ đại',
  'I find that the harder I work, the more luck I seem to have': 'Tôi nhận ra rằng càng làm việc chăm chỉ, tôi càng có vẻ may mắn hơn',
  'The future belongs to those who believe in the beauty of their dreams': 'Tương lai thuộc về những người tin vào vẻ đẹp của giấc mơ của mình',
  'You cannot cross the sea merely by standing and staring at the water': 'Bạn không thể chinh phục biển cả chỉ bằng cách đứng đó nhìn nước',
  'When the storm disrupted the expedition, the researchers protected their notes': 'Khi cơn bão làm gián đoạn cuộc thám hiểm, các nhà nghiên cứu đã bảo vệ những ghi chép của họ',
  'They then compared their observations with the forecasts prepared before departure': 'Sau đó, họ so sánh quan sát của mình với các dự báo đã chuẩn bị trước khi khởi hành',
  'Although the original route was no longer safe, their evidence suggested another path': 'Mặc dù lộ trình ban đầu không còn an toàn, bằng chứng của họ gợi ý một con đường khác',
  'The team postponed the journey rather than allowing urgency to replace careful judgment': 'Nhóm đã trì hoãn chuyến đi thay vì để sự cấp bách thay thế cho sự phán đoán thận trọng',
  'Their patience ultimately produced a safer and more accurate account of the region': 'Sự kiên nhẫn của họ cuối cùng đã tạo ra một bản mô tả an toàn và chính xác hơn về khu vực',
};

const TRANSLATION_MAP: Record<string, string> = {
  ...EASY_TRANSLATIONS,
  ...MEDIUM_TRANSLATIONS,
  ...HARD_TRANSLATIONS,
};

export const EASY_SENTENCE_TRANSLATIONS = EASY_TRANSLATIONS;

export const getEasySentenceTranslation = (sentence: string) => {
  const exactMatch = EASY_TRANSLATIONS[sentence];
  if (exactMatch) return exactMatch;

  if (/^I can\b/i.test(sentence)) return sentence.replace(/^I can\s+/i, 'Tôi có thể ');
  if (/^We can\b/i.test(sentence)) return sentence.replace(/^We can\s+/i, 'Chúng ta có thể ');
  if (/^You can\b/i.test(sentence)) return sentence.replace(/^You can\s+/i, 'Bạn có thể ');
  if (/^They can\b/i.test(sentence)) return sentence.replace(/^They can\s+/i, 'Họ có thể ');
  if (/^My friend can\b/i.test(sentence)) return sentence.replace(/^My friend can\s+/i, 'Bạn tôi có thể ');
  if (/^A good habit can\b/i.test(sentence)) return sentence.replace(/^A good habit can\s+/i, 'Một thói quen tốt có thể ');
  if (/^Daily practice can\b/i.test(sentence)) return sentence.replace(/^Daily practice can\s+/i, 'Luyện tập hàng ngày có thể ');
  if (/^A clear goal can\b/i.test(sentence)) return sentence.replace(/^A clear goal can\s+/i, 'Mục tiêu rõ ràng có thể ');
  if (/^Small changes can\b/i.test(sentence)) return sentence.replace(/^Small changes can\s+/i, 'Những thay đổi nhỏ có thể ');
  if (/^Quiet focus can\b/i.test(sentence)) return sentence.replace(/^Quiet focus can\s+/i, 'Sự tập trung yên lặng có thể ');
  if (/^Kind words can\b/i.test(sentence)) return sentence.replace(/^Kind words can\s+/i, 'Lời nói tử tế có thể ');
  if (/^Fresh ideas can\b/i.test(sentence)) return sentence.replace(/^Fresh ideas can\s+/i, 'Ý tưởng mới mẻ có thể ');
  if (/^A short break can\b/i.test(sentence)) return sentence.replace(/^A short break can\s+/i, 'Một khoảng nghỉ ngắn có thể ');
  if (/^Regular reading can\b/i.test(sentence)) return sentence.replace(/^Regular reading can\s+/i, 'Đọc đều đặn có thể ');
  if (/^Simple plans can\b/i.test(sentence)) return sentence.replace(/^Simple plans can\s+/i, 'Kế hoạch đơn giản có thể ');
  if (/^Patient effort can\b/i.test(sentence)) return sentence.replace(/^Patient effort can\s+/i, 'Nỗ lực kiên nhẫn có thể ');

  return `Bản dịch: ${sentence}`;
};

const translateGenericSentence = (sentence: string) => {
  const normalized = sentence.trim().replace(/[.!?]+$/, '');
  if (!normalized) return 'Bản dịch: ';

  const replacements: [RegExp, string][] = [
    [/\bThe\b/gi, 'Những'],
    [/\bA\b/gi, 'Một'],
    [/\bAn\b/gi, 'Một'],
    [/\bWhen\b/gi, 'Khi'],
    [/\bBecause\b/gi, 'Bởi vì'],
    [/\bAlthough\b/gi, 'Mặc dù'],
    [/\bHowever\b/gi, 'Tuy nhiên'],
    [/\bWhile\b/gi, 'Trong khi'],
    [/\bBefore\b/gi, 'Trước khi'],
    [/\bAfter\b/gi, 'Sau khi'],
    [/\bIf\b/gi, 'Nếu'],
    [/\bAnd\b/gi, 'và'],
    [/\bOr\b/gi, 'hoặc'],
    [/\bBut\b/gi, 'nhưng'],
    [/\bWith\b/gi, 'với'],
    [/\bWithout\b/gi, 'mà không'],
    [/\bCan\b/gi, 'có thể'],
    [/\bCould\b/gi, 'có thể'],
    [/\bShould\b/gi, 'nên'],
    [/\bMust\b/gi, 'phải'],
    [/\bWill\b/gi, 'sẽ'],
    [/\bWould\b/gi, 'sẽ'],
    [/\bMore\b/gi, 'hơn'],
    [/\bLess\b/gi, 'ít hơn'],
    [/\bBetter\b/gi, 'tốt hơn'],
    [/\bEasier\b/gi, 'dễ hơn'],
    [/\bHarder\b/gi, 'khó hơn'],
    [/\bStronger\b/gi, 'mạnh hơn'],
    [/\bFaster\b/gi, 'nhanh hơn'],
    [/\bProgress\b/gi, 'tiến bộ'],
    [/\bResults\b/gi, 'kết quả'],
    [/\bDecision\b/gi, 'quyết định'],
    [/\bPlan\b/gi, 'kế hoạch'],
    [/\bPractice\b/gi, 'luyện tập'],
    [/\bLearning\b/gi, 'học tập'],
    [/\bWork\b/gi, 'công việc'],
    [/\bTeam\b/gi, 'đội ngũ'],
    [/\bOpportunity\b/gi, 'cơ hội'],
    [/\bChance\b/gi, 'cơ hội'],
    [/\bFuture\b/gi, 'tương lai'],
    [/\bSuccess\b/gi, 'thành công'],
    [/\bFailure\b/gi, 'thất bại'],
    [/\bDoubt\b/gi, 'nghi ngờ'],
    [/\bPeople\b/gi, 'mọi người'],
    [/\bTogether\b/gi, 'cùng nhau'],
    [/\bImportant\b/gi, 'quan trọng'],
    [/\bMeaningful\b/gi, 'có ý nghĩa'],
    [/\bDifficult\b/gi, 'khó khăn'],
    [/\bSimple\b/gi, 'đơn giản'],
    [/\bCareful\b/gi, 'cẩn thận'],
    [/\bClear\b/gi, 'rõ ràng'],
    [/\bUseful\b/gi, 'hữu ích'],
    [/\bGood\b/gi, 'tốt'],
    [/\bGreat\b/gi, 'vĩ đại'],
    [/\bSmall\b/gi, 'nhỏ'],
    [/\bLarge\b/gi, 'lớn'],
    [/\bPurpose\b/gi, 'mục đích'],
    [/\bJourney\b/gi, 'hành trình'],
    [/\bStep\b/gi, 'bước'],
    [/\bLife\b/gi, 'cuộc sống'],
    [/\bTime\b/gi, 'thời gian'],
    [/\bWay\b/gi, 'cách'],
    [/\bKnowledge\b/gi, 'kiến thức'],
  ];

  let translated = normalized;
  replacements.forEach(([pattern, replacement]) => {
    translated = translated.replace(pattern, replacement);
  });

  return `Bản dịch gợi ý: ${translated}`;
};

export const getSentenceTranslation = (sentence: string, difficulty: Difficulty = 'easy') => {
  const exactMatch = TRANSLATION_MAP[sentence];
  if (exactMatch) return exactMatch;

  if (difficulty === 'easy') return getEasySentenceTranslation(sentence);

  return translateGenericSentence(sentence);
};
