export type Difficulty = 'easy' | 'medium' | 'hard';

const createSentences = (subjects: string[], endings: string[], count: number) =>
  Array.from({ length: count }, (_, index) => {
    const subject = subjects[Math.floor(index / endings.length) % subjects.length];
    const ending = endings[index % endings.length];
    return `${subject} ${ending}`;
  });

const cleanSentences = (sentences: string[]) =>
  sentences.map(sentence => sentence.replace(/[.!?]+$/, ''));

const easyGenerated = createSentences(
  [
    'I can', 'We can', 'You can', 'They can', 'My friend can',
    'A good habit can', 'Daily practice can', 'A clear goal can',
    'Small changes can', 'Quiet focus can', 'Kind words can', 'Fresh ideas can',
    'A short break can', 'Regular reading can', 'Simple plans can', 'Patient effort can',
  ],
  [
    'build confidence.', 'make work easier.', 'open new doors.', 'bring people closer.',
    'turn mistakes into lessons.', 'help us stay calm.', 'create better habits.',
    'make a real difference.', 'keep the mind active.', 'lead to good results.',
  ],
  152,
);

const mediumGenerated = createSentences(
  [
    'A thoughtful learner', 'A curious mind', 'A steady routine', 'Good preparation',
    'Patient practice', 'An honest review', 'A clear explanation', 'A useful question',
    'Careful attention', 'A positive attitude', 'A quiet workspace', 'Regular feedback',
    'A simple system', 'Consistent effort', 'An open conversation', 'A challenging goal',
  ],
  [
    'turns difficult ideas into practical skills.', 'helps us notice progress over time.',
    'makes complex tasks easier to manage.', 'creates space for better decisions.',
    'keeps important details from being forgotten.', 'gives every new attempt a purpose.',
    'helps people learn from unexpected results.', 'builds confidence through small successes.',
    'makes room for creativity and careful thought.', 'can transform a routine into meaningful progress.',
  ],
  152,
);

const hardGenerated = createSentences(
  [
    'Meaningful progress often begins when', 'The strongest ideas emerge after',
    'Long-term improvement becomes possible when', 'A thoughtful decision requires that',
    'The most reliable results appear when', 'Creative solutions are easier to find when',
    'A resilient team becomes stronger when', 'Lasting change usually depends on',
    'An ambitious goal becomes manageable once', 'Good judgment improves whenever',
    'A difficult problem deserves attention before', 'Effective communication succeeds when',
    'A careful experiment can teach us why', 'Real understanding develops as',
    'A useful lesson remains valuable even when', 'Independent thinking matters because',
  ],
  [
    'we question the assumptions behind our first answer',
    'we compare different perspectives without dismissing either one',
    'we accept uncertainty and continue testing what we believe',
    'we turn temporary setbacks into information for the next attempt',
    'we balance immediate results with consequences that may appear later',
    'we make time to examine both the evidence and the reasoning',
    'we replace vague intentions with specific actions and honest feedback',
    'we remain patient enough to recognize patterns that are not obvious at first',
    'we understand that consistency is often more powerful than intensity',
    'we listen carefully before deciding which conclusion the facts support',
  ],
  151,
);

const easyAdditional = createSentences(
  [
    'The morning sun can', 'A warm cup of tea can', 'One kind message can', 'A tidy desk can',
    'A gentle walk can', 'Fresh air can', 'A shared meal can', 'A good book can',
    'A mindful breath can', 'A useful note can', 'A simple question can', 'A friendly smile can',
    'A clean room can', 'A quiet song can', 'An early start can', 'A clear answer can',
    'A helping hand can',
  ],
  [
    'brighten the whole morning.', 'make a busy day feel lighter.', 'help us find a new idea.',
    'give us energy for the next task.', 'make a difficult moment easier.', 'bring a little peace.',
    'remind us to slow down.', 'help everyone feel welcome.', 'turn a plan into action.',
    'make learning more enjoyable.',
  ],
  167,
);

const mediumAdditional = createSentences(
  [
    'A well-organized schedule', 'A patient teacher', 'A reliable teammate', 'A careful reader',
    'A focused conversation', 'A balanced routine', 'A practical example', 'A written reminder',
    'A shared responsibility', 'A realistic deadline', 'A calm response', 'A thoughtful plan',
    'A useful comparison', 'A regular review', 'A clear priority', 'A flexible approach',
    'A welcoming environment',
  ],
  [
    'helps important work move forward without unnecessary stress.',
    'allows people to solve problems with greater confidence.',
    'makes it easier to understand how separate details connect.',
    'can improve both the quality and the speed of a decision.',
    'creates a stronger foundation for future progress.',
    'encourages everyone to contribute their best ideas.',
    'turns a confusing task into a series of manageable steps.',
    'helps us respond thoughtfully instead of reacting too quickly.',
    'can reveal opportunities that were hidden by routine assumptions.',
    'makes progress visible even when the final result is still distant.',
  ],
  167,
);

const hardAdditional = createSentences(
  [
    'A responsible leader recognizes that', 'A careful investigation reveals how',
    'A lasting solution becomes possible once', 'A complex conversation improves when',
    'A mature perspective accepts that', 'A strong argument depends on whether',
    'A sustainable process requires that', 'A difficult negotiation succeeds when',
    'A valuable discovery often occurs after', 'A fair evaluation considers whether',
    'A precise explanation matters because', 'A balanced conclusion emerges when',
    'A disciplined approach prevents us from', 'A generous interpretation allows us to',
    'A meaningful collaboration begins when', 'A careful observer notices that',
    'A trustworthy system remains useful only when',
  ],
  [
    'we distinguish what the evidence shows from what we merely expect',
    'we identify the limits of a method before applying it elsewhere',
    'we consider the long-term effects alongside the immediate benefits',
    'we make room for disagreement without turning it into personal conflict',
    'we revise our plans whenever new information changes the situation',
    'we explain not only what happened but also why it happened that way',
    'we protect essential principles while remaining open to practical change',
    'we test a promising idea against the conditions it must actually survive',
    'we acknowledge uncertainty instead of hiding it behind confident language',
    'we measure success by the value created for everyone affected by the outcome',
  ],
  166,
);

const grammarSentences: Record<Difficulty, string[]> = {
  easy: [
    'I am ready for my English lesson',
    'She does not like noisy places',
    'Do you practice English every day',
    'We are learning new words together',
    'He went to the library yesterday',
    'They will visit their teacher tomorrow',
    'There is a notebook on the table',
    'There are three useful examples here',
    'I have already finished my homework',
    'She has lived here for two years',
    'Please listen carefully before you answer',
    'If you practice often, you will improve',
  ],
  medium: [
    'I have been studying English since the beginning of the year',
    'She was reading when her friend called',
    'They had finished dinner before the movie started',
    'If I had more time, I would read another book',
    'The lesson was easier than I expected',
    'This is the most useful exercise in the workbook',
    'He asked me whether I understood the instructions',
    'Although the weather was cold, we continued our walk',
    'The project must be completed before Friday afternoon',
    'People who read regularly often learn new words faster',
    'I am not sure which answer the teacher prefers',
    'By the time we arrived, the class had already begun',
  ],
  hard: [
    'If the researchers had checked the data earlier, they might have avoided the error',
    'The book, which was published last year, has already become a valuable reference',
    'Having completed the experiment, the students carefully compared their results',
    'The manager asked whether the revised proposal could be submitted before noon',
    'Despite being exhausted after the journey, she continued working on the report',
    'What matters most is how consistently we apply what we have learned',
    'The more carefully you listen, the easier it becomes to recognize natural phrases',
    'Unless the evidence changes, the committee is unlikely to revise its conclusion',
    'The course encourages learners to explain ideas that they would normally avoid discussing',
    'It is essential that every participant be given enough time to consider the question',
    'The teacher explained that the assignment should have been completed before the meeting',
    'Had we known about the delay, we would have chosen a different route',
  ],
};

const vocabularySentences: Record<Difficulty, string[]> = {
  easy: [
    'The bright window made the small room feel welcoming',
    'Please place the empty bottle beside the kitchen sink',
    'The helpful guide showed us a quiet path through the park',
    'A healthy breakfast gives you energy for the morning',
    'The careful driver noticed a narrow bridge ahead',
    'We packed a light jacket because the evening might be cool',
    'The local market sells fresh fruit and handmade gifts',
    'Her favorite hobby is painting colorful pictures',
    'The simple recipe needs flour, eggs, and a little butter',
    'A friendly neighbor offered useful advice',
    'The train arrived at the busy station on time',
    'Reading short stories is an enjoyable way to learn',
  ],
  medium: [
    'The reliable equipment helped the team complete the difficult task',
    'A flexible schedule makes it easier to balance work and study',
    'The speaker gave a clear explanation of the unfamiliar process',
    'Our neighborhood has several affordable restaurants near the river',
    'The museum displays remarkable objects from ancient civilizations',
    'A thoughtful response can prevent a small disagreement from becoming serious',
    'The company introduced an efficient system for organizing customer requests',
    'Regular exercise can improve concentration as well as physical health',
    'The journalist confirmed the information with an independent source',
    'A practical solution should be affordable, reliable, and easy to maintain',
    'The students discussed the environmental impact of excessive packaging',
    'The unfamiliar vocabulary became easier after we saw it in context',
  ],
  hard: [
    'The architect proposed a sustainable design that would reduce the building’s energy consumption',
    'The investigation revealed several inconsistencies in the original financial report',
    'Effective collaboration depends on transparent communication and shared responsibility',
    'The speaker presented a compelling argument supported by independent evidence',
    'A sophisticated vocabulary is useful only when each word is used with precision',
    'The expedition required careful preparation because the terrain was unpredictable',
    'The policy aims to encourage innovation while protecting vulnerable communities',
    'The scientist recorded a significant increase in biodiversity after the restoration project',
    'A comprehensive review identified practical improvements to the organization’s workflow',
    'The negotiation reached a temporary agreement despite considerable disagreement',
    'The concept became more accessible after the professor provided a concrete example',
    'Long-term sustainability requires investment, patience, and responsible decision-making',
  ],
};

const SAMPLE_SENTENCES: Record<'en-US', Record<Difficulty, string[]>> = {
  'en-US': {
    easy: cleanSentences([
      'Practice makes perfect',
      'Keep going one step at a time',
      'Small steps make a big difference',
      'Every day is a fresh start',
      'Learning takes time and patience',
      'Believe in yourself',
      'Stay calm and focused',
      'Good things take time',
      'Dream big and work hard',
      'Enjoy the little moments',
      'Mia found a small garden behind the library',
      'She planted three seeds and watered them every morning',
      'The first green leaves appeared after a week',
      'Mia shared the fresh herbs with her neighbors',
      'Soon the little garden became a place for everyone',
      ...easyGenerated,
      ...easyAdditional,
      ...grammarSentences.easy,
      ...vocabularySentences.easy,
    ]),
    medium: cleanSentences([
      'Practice makes perfect when it comes to language learning',
      'Technology is best when it brings people together',
      'In the middle of difficulty lies opportunity',
      'Life is what happens when you are busy making other plans',
      'The best way to predict the future is to invent it',
      'It does not matter how slowly you go as long as you do not stop',
      'You miss one hundred percent of the shots you do not take',
      'The only way to do great work is to love what you do',
      'The journey of a thousand miles begins with one step',
      'Opportunities do not happen. You create them',
      'Alex started a new project with a simple plan',
      'Each morning, the team reviewed one small goal',
      'Their careful progress revealed problems early',
      'They adjusted the plan and learned from every setback',
      'After several weeks, the project was ready to share',
      ...mediumGenerated,
      ...mediumAdditional,
      ...grammarSentences.medium,
      ...vocabularySentences.medium,
    ]),
    hard: cleanSentences([
      'The only limit to our realization of tomorrow is our doubts of today',
      'Do not go where the path may lead, go instead where there is no path and leave a trail',
      'To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment',
      'I have not failed. I have just found ten thousand ways that will not work',
      'Whether you think you can or you think you cannot, you are right',
      'Success usually comes to those who are too busy to be looking for it',
      'Do not be afraid to give up the good to go for the great',
      'I find that the harder I work, the more luck I seem to have',
      'The future belongs to those who believe in the beauty of their dreams',
      'You cannot cross the sea merely by standing and staring at the water',
      'When the storm disrupted the expedition, the researchers protected their notes',
      'They then compared their observations with the forecasts prepared before departure',
      'Although the original route was no longer safe, their evidence suggested another path',
      'The team postponed the journey rather than allowing urgency to replace careful judgment',
      'Their patience ultimately produced a safer and more accurate account of the region',
      ...hardGenerated,
      ...hardAdditional,
      ...grammarSentences.hard,
      ...vocabularySentences.hard,
    ]),
  },
};

export default SAMPLE_SENTENCES;
