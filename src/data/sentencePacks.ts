import type { Difficulty } from '../utils/sentenceTranslations';

export type PremiumSentencePack = 'ielts' | 'business';
export type SentencePack = Record<Difficulty, string[]>;

export const IDIOM_SENTENCE_PACK: SentencePack = {
  easy: [
    'I was feeling under the weather, so I stayed home.',
    'She let the cat out of the bag about the surprise.',
    'We are all ears, so tell us your idea.',
    'He decided to break the ice with a friendly joke.',
    'They hit the road before sunrise.',
    'I am a little short on time this morning.',
    'Do not worry, the test was a piece of cake.',
    'Let us call it a day and finish tomorrow.',
  ],
  medium: [
    'When the plan changed at the last minute, we had to think on our feet.',
    'Maya has been burning the midnight oil to finish her research.',
    'The neighbors made themselves at home during the picnic.',
    'After several delays, the project is finally back on track.',
    'He missed the point because he took her lighthearted comment literally.',
    'We should take that estimate with a grain of salt until it is confirmed.',
    'The new assistant learned the ropes by shadowing an experienced colleague.',
    'I wanted to help, but I did not want to add fuel to the fire.',
  ],
  hard: [
    'Although the proposal looked promising, the committee asked us to go back to the drawing board.',
    'She was walking on eggshells around her teammate after their disagreement.',
    'Because the launch date was moved forward, everyone had to pull out all the stops.',
    'I thought the revised schedule would be difficult, but we managed to get the ball rolling.',
    'If the supplier misses another deadline, the whole team could be left in the lurch.',
    'He tends to beat around the bush, so I asked him directly for a decision.',
    'The manager’s suggestion seemed risky at first, but it turned out to be a blessing in disguise.',
    'We could not afford to cut corners, even though we were under pressure to finish on time.',
  ],
};

// These packs are original practice content owned by the app.
export const PREMIUM_SENTENCE_PACKS: Record<PremiumSentencePack, SentencePack> = {
  ielts: {
    easy: [
      'Many students choose to study in another country.',
      'Public transport can reduce traffic in large cities.',
      'Reading every day helps people develop a wider vocabulary.',
      'Local libraries give residents access to books, computers, and study spaces.',
      'Cycling to nearby destinations can improve health and reduce pollution.',
      'Community gardens help city residents grow fresh food together.',
      'Students often learn more when lessons include practical activities.',
      'Reliable public transport makes it easier for people to reach work.',
    ],
    medium: [
      'Some people believe that online courses are more flexible than traditional classes.',
      'Governments should invest in public transport before expanding city roads.',
      'The quality of education depends on both resources and effective teaching.',
      'Flexible working hours can help employees balance professional and family responsibilities.',
      'Access to affordable housing influences the choices available to young adults.',
      'Schools can encourage healthier habits by making nutritious meals more accessible.',
      'Public parks provide valuable places for exercise, relaxation, and community events.',
      'Careful urban planning can reduce the distance people need to travel each day.',
    ],
    hard: [
      'Although technology has transformed education, it cannot replace the motivation created by a supportive teacher.',
      'The long-term consequences of rapid urbanization should be considered before further development is approved.',
      'A balanced argument must acknowledge the immediate benefits as well as the potential social costs.',
      'If digital resources are to improve learning, schools must ensure that students can access them reliably.',
      'Policies designed to reduce congestion are more effective when public transport is affordable and dependable.',
      'Economic growth should be assessed alongside its effects on public health and the natural environment.',
      'While standardized tests provide useful comparisons, they cannot capture every aspect of a student’s progress.',
      'Long-term investment in preventive healthcare may reduce pressure on public services in the future.',
    ],
  },
  business: {
    easy: [
      'Our team will discuss the project after lunch.',
      'Please send the updated report before Friday.',
      'The customer asked for a clearer explanation.',
      'The team agreed to review the project schedule tomorrow.',
      'Please confirm the meeting room before inviting the client.',
      'Our supplier will send the revised estimate this afternoon.',
      'The presentation includes a summary of the latest results.',
      'I have added your comments to the shared document.',
    ],
    medium: [
      'The manager postponed the meeting because several figures needed to be checked.',
      'We should identify the main risk before presenting the proposal to the client.',
      'Clear communication helps a team resolve problems before they affect the deadline.',
      'The finance team will compare the revised forecast with last quarter’s results.',
      'Please circulate the meeting notes so each department can confirm its next steps.',
      'The client requested a phased delivery plan with clear review dates.',
      'We should document the assumptions behind the proposal before approving the budget.',
      'The project lead will assign responsibilities after the scope has been confirmed.',
    ],
    hard: [
      'The revised strategy is viable only if the organization can measure its results consistently.',
      'Before entering a new market, the company should test its assumptions against several realistic scenarios.',
      'A sustainable partnership requires transparent expectations, shared accountability, and a willingness to adapt.',
      'The board requested evidence that the proposed expansion would generate sustainable revenue.',
      'Although the launch met its initial targets, the team will review customer feedback before scaling the service.',
      'A realistic forecast should account for operational costs, market uncertainty, and potential delays.',
      'The department revised its procurement process to improve transparency and reduce avoidable spending.',
      'Managers should explain how performance measures relate to the organization’s broader objectives.',
    ],
  },
};
