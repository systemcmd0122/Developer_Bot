// commands/fortune.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

module.exports = {
    category: 'エンターテイメント',
    data: new SlashCommandBuilder()
        .setName('fortune')
        .setDescription('今日の運勢を占います')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('おみくじの種類')
                .setRequired(false)
                .addChoices(
                    { name: '通常おみくじ', value: 'normal' },
                    { name: '恋愛おみくじ', value: 'love' },
                    { name: 'ゲーマーおみくじ', value: 'gamer' },
                    { name: 'プログラマーおみくじ', value: 'programmer' }
                )
        ),
    async execute(interaction) {
        await interaction.deferReply();

        const userId = interaction.user.id;
        const username = interaction.user.username;
        const type = interaction.options.getString('type') || 'normal';
        
        // 今日の日付をシード値として使用
        const today = new Date();
        const dateString = `${today.getFullYear()}${today.getMonth()}${today.getDate()}`;
        const seed = parseInt(dateString + userId);
        
        // シード値から運勢を決定
        const fortune = getFortuneResult(seed, type);
        
        // 結果をJSONに保存
        saveFortuneHistory(userId, username, fortune, type);
        
        // 運勢に応じた色を設定
        const colors = {
            '大吉': '#FF0000',
            '中吉': '#FFA500',
            '小吉': '#FFFF00',
            '吉': '#00FF00',
            '末吉': '#00FFFF',
            '凶': '#0000FF',
            '大凶': '#800080'
        };
        
        // 運勢に応じた絵文字を設定
        const emojis = {
            '大吉': '🌟',
            '中吉': '✨',
            '小吉': '🍀',
            '吉': '😊',
            '末吉': '🤔',
            '凶': '☁️',
            '大凶': '⚡'
        };
        
        // アニメーション効果のための遅延
        setTimeout(async () => {
            // ランダムなアドバイスを取得
            const advice = getRandomAdvice(type);
            
            // 運勢メッセージを作成
            const embed = new EmbedBuilder()
                .setTitle(`${emojis[fortune.luck]} ${username}さんの${getTypeName(type)}結果 ${emojis[fortune.luck]}`)
                .setDescription(`**${fortune.luck}**`)
                .setColor(colors[fortune.luck])
                .addFields(
                    { name: '💫 今日のラッキーポイント', value: fortune.luckyPoint, inline: false },
                    { name: '🔮 アドバイス', value: advice, inline: false },
                    { name: '🎲 ラッキーナンバー', value: `${Math.floor(seed % 100)}`, inline: true },
                    { name: '🌈 ラッキーカラー', value: fortune.luckyColor, inline: true }
                )
                .setFooter({ 
                    text: `ID: ${uuidv4().substring(0, 8)} • ${today.toLocaleDateString('ja-JP')}のおみくじ`,
                })
                .setTimestamp();
            
            // ユーザーの運勢に基づいて特別なメッセージを追加
            if (fortune.luck === '大吉') {
                embed.addFields({ name: '🎉 特別メッセージ', value: '素晴らしい1日になるでしょう！何事もうまくいきます！', inline: false });
            } else if (fortune.luck === '大凶') {
                embed.addFields({ name: '⚠️ 注意', value: '今日は慎重に行動しましょう。明日はきっと良い日になります！', inline: false });
                
                // 大凶の場合は回避方法も提案
                embed.addFields({ name: '🛡️ 凶を回避する方法', value: getAvoidanceTip(), inline: false });
            }
            
            // 特殊効果（タイプに応じた追加情報）
            if (type === 'programmer') {
                embed.addFields({ name: '💻 今日のバグ発生確率', value: `${Math.floor((seed % 30) + 5)}%`, inline: true });
                embed.addFields({ name: '⌨️ おすすめ言語', value: getRandomProgrammingLanguage(seed), inline: true });
            } else if (type === 'gamer') {
                embed.addFields({ name: '🎮 プレイすべきゲームジャンル', value: getRandomGameGenre(seed), inline: true });
                embed.addFields({ name: '🏆 今日の勝率', value: `${Math.floor((seed % 50) + 50)}%`, inline: true });
            } else if (type === 'love') {
                embed.addFields({ name: '💕 運命の出会いの場所', value: getRandomMeetingPlace(seed), inline: true });
                embed.addFields({ name: '💌 好印象を与えるアプローチ', value: getRandomApproach(seed), inline: true });
            }
            
            // 結果を表示
            await interaction.editReply({ embeds: [embed] });
            
            // 大吉や大凶の場合は追加反応
            if (fortune.luck === '大吉' || fortune.luck === '大凶') {
                setTimeout(() => {
                    interaction.followUp({
                        content: fortune.luck === '大吉' 
                            ? `${interaction.user}さん、素晴らしい！大吉ですよ！🎉🎉🎉`
                            : `${interaction.user}さん、大丈夫です。これは単なる占いです😅 気にしないでください！`,
                        ephemeral: false
                    });
                }, 1500);
            }
        }, 2000);
    },
};

// 運勢結果を取得する関数
function getFortuneResult(seed, type) {
    const random = mulberry32(seed);
    
    // 運勢の確率: 大吉(5%), 中吉(10%), 小吉(20%), 吉(30%), 末吉(20%), 凶(10%), 大凶(5%)
    const luckRand = random();
    let luck;
    
    if (luckRand < 0.05) luck = '大吉';
    else if (luckRand < 0.15) luck = '中吉';
    else if (luckRand < 0.35) luck = '小吉';
    else if (luckRand < 0.65) luck = '吉';
    else if (luckRand < 0.85) luck = '末吉';
    else if (luckRand < 0.95) luck = '凶';
    else luck = '大凶';
    
    // ラッキーポイントを取得
    const luckyPoints = {
        'normal': ['家族との会話', '新しい本', '散歩', '朝食', '自然', '音楽鑑賞', '掃除', '早起き', '温かい飲み物', 'SNSの休憩'],
        'love': ['誠実な会話', 'カフェでのデート', '手紙', '思い出の場所', 'サプライズプレゼント', '共通の趣味', '料理作り', '自然の中でのんびり', '映画鑑賞', 'アイコンタクト'],
        'gamer': ['新作ゲーム', 'オンライン対戦', 'レトロゲーム', 'ストーリーモード', 'アチーブメント集め', 'フレンドとのプレイ', 'ゲーム配信', 'ゲームの攻略本', 'Eスポーツ観戦', 'ゲームBGM'],
        'programmer': ['新言語の勉強', 'リファクタリング', 'コードレビュー', 'オープンソースへの貢献', 'スタック・オーバーフローでの回答', 'テスト駆動開発', 'デバッグの集中時間', 'コーディング規約の見直し', 'プロジェクト計画', 'コードの最適化']
    };
    
    const luckyPoint = luckyPoints[type][Math.floor(random() * luckyPoints[type].length)];
    
    // ラッキーカラーを取得
    const colors = ['赤', '青', '黄', '緑', '紫', 'オレンジ', 'ピンク', '白', '黒', '水色', '金', '銀', '茶色', '灰色'];
    const luckyColor = colors[Math.floor(random() * colors.length)];
    
    return { luck, luckyPoint, luckyColor };
}

// シード値から疑似乱数を生成する関数（Mulberry32アルゴリズム）
function mulberry32(seed) {
    return function() {
        seed += 0x6D2B79F5;
        let t = seed;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// ランダムなアドバイスを取得する関数
function getRandomAdvice(type) {
    const advices = {
        'normal': [
            '今日は新しいことに挑戦してみましょう。',
            '人との繋がりを大切にすると良いことがあります。',
            '自分の時間を作ることで心が落ち着きます。',
            '積極的な行動が幸運を引き寄せるでしょう。',
            '小さな幸せに気づく目を持ちましょう。',
            '感謝の気持ちを忘れないでいることが大切です。',
            '焦らず着実に進むことで良い結果が得られます。',
            '直感を信じて行動してみましょう。',
            '困っている人を助けると良いことが返ってきます。',
            '自分を信じる気持ちが成功への鍵です。'
        ],
        'love': [
            '自分らしさを大切にすることで魅力が増します。',
            '相手の話をしっかり聞くことが大切です。',
            '思い切った告白が実を結ぶ日かもしれません。',
            '小さな気遣いが相手の心を動かします。',
            '自然体で接することが最大の武器です。',
            '共通の趣味を見つけると仲が深まります。',
            '焦らず関係を育んでいきましょう。',
            '思いやりのある言葉がキーポイントです。',
            '相手の良いところを見つける目を持ちましょう。',
            '笑顔が最高のコミュニケーションツールです。'
        ],
        'gamer': [
            '今日は新しいゲームジャンルに挑戦してみましょう。',
            'チームプレイで思わぬ発見があるかもしれません。',
            '攻略を見ずに自分の力で進めてみましょう。',
            'ソロプレイに集中すると新たな発見があります。',
            'ゲームの設定や背景ストーリーを楽しむと良いでしょう。',
            '定期的な休憩が集中力を高めます。',
            '難しいボスには新しい戦略を試してみましょう。',
            'フレンドと情報交換すると有益な情報が得られます。',
            'ストレスを感じたら別のゲームに切り替えましょう。',
            'スキルよりも楽しむことを優先しましょう。'
        ],
        'programmer': [
            '今日はコードの最適化に取り組むと良い発見があります。',
            '難しい問題は一度離れてみると解決策が見つかるでしょう。',
            'ペアプログラミングで効率が上がるかもしれません。',
            '新しいライブラリやフレームワークを学ぶ良い機会です。',
            'ドキュメント作成に時間をかけると将来の自分が喜びます。',
            'テストケースを増やすことでバグが減少するでしょう。',
            'コードレビューを依頼すると新たな視点が得られます。',
            'プログラミングコミュニティに参加すると刺激を受けます。',
            '古いコードをリファクタリングする良い日です。',
            '基本に立ち返ることで新たな発見があるでしょう。'
        ]
    };
    
    const randomIndex = Math.floor(Math.random() * advices[type].length);
    return advices[type][randomIndex];
}

// 大凶時の回避方法を取得する関数
function getAvoidanceTip() {
    const tips = [
        '深呼吸をして、ポジティブな考えを心がけましょう。',
        '今日は大きな決断を避け、慎重に行動しましょう。',
        '暗い色の服を避け、明るい色を身につけると良いでしょう。',
        '誰かに親切にすることで運気が上がります。',
        '水をたくさん飲んで、浄化の力を借りましょう。',
        '今日は早めに休んで、明日に備えましょう。',
        '笑顔を心がけると不運を遠ざけることができます。',
        '小さな幸せに感謝する気持ちが運気を上げます。',
        '自分の好きな音楽を聴いて、心を落ち着けましょう。',
        '信頼できる友人と過ごすと運気が上がります。'
    ];
    
    return tips[Math.floor(Math.random() * tips.length)];
}

// ランダムなプログラミング言語を取得する関数
function getRandomProgrammingLanguage(seed) {
    const languages = [
        'JavaScript', 'Python', 'Java', 'C#', 'TypeScript', 'Ruby', 'Go', 'Swift', 'Kotlin', 'Rust',
        'PHP', 'C++', 'Dart', 'Scala', 'Haskell', 'Elixir', 'Clojure', 'F#', 'COBOL', 'Assembly'
    ];
    
    return languages[seed % languages.length];
}

// ランダムなゲームジャンルを取得する関数
function getRandomGameGenre(seed) {
    const genres = [
        'RPG', 'FPS', 'アクション', 'アドベンチャー', 'シミュレーション', 'パズル', 'レーシング',
        'スポーツ', 'ストラテジー', 'MMORPG', 'MOBA', 'ホラー', 'オープンワールド', 'リズムゲーム',
        'ファイティング', 'サンドボックス', 'ローグライク', 'カードゲーム', 'タワーディフェンス', 'バトルロイヤル'
    ];
    
    return genres[seed % genres.length];
}

// ランダムな出会いの場所を取得する関数
function getRandomMeetingPlace(seed) {
    const places = [
        'カフェ', '書店', '公園', '美術館', '映画館', 'コンサート', 'スポーツジム', '料理教室',
        '語学教室', '友人のパーティー', '職場', '電車', '通勤路', 'SNS', 'オンラインゲーム',
        '趣味のサークル', 'ボランティア活動', '旅行先', 'ショッピングモール', 'ペットショップ'
    ];
    
    return places[seed % places.length];
}

// ランダムなアプローチ方法を取得する関数
function getRandomApproach(seed) {
    const approaches = [
        '共通の話題で会話を始める', '自然な笑顔で接する', '相手の話に興味を持って聞く',
        '小さな親切を心がける', '共通の趣味の誘いをする', '素直な気持ちを伝える',
        'グループ活動に誘ってみる', 'ユーモアを交えた会話をする', '相手の良いところを褒める',
        '偶然を装った再会を演出する', '友人を介して知り合う', '趣味の話から始める',
        'SNSでつながりを持つ', '手作りのものをプレゼントする', '困っているときに助ける',
        '相手の好きなものについて質問する', '特別なイベントに誘う', '自分の得意なことを教える',
        '相手のペースに合わせる', '自分らしさを大切にしながら接する'
    ];
    
    return approaches[seed % approaches.length];
}

// おみくじの種類の名前を取得する関数
function getTypeName(type) {
    const typeNames = {
        'normal': 'おみくじ',
        'love': '恋愛おみくじ',
        'gamer': 'ゲーマーおみくじ',
        'programmer': 'プログラマーおみくじ'
    };
    
    return typeNames[type];
}

// おみくじの結果を履歴として保存する関数
function saveFortuneHistory(userId, username, fortune, type) {
    try {
        const dataDir = path.join(__dirname, '..', 'data');
        const filePath = path.join(dataDir, 'fortune_history.json');
        
        // データディレクトリが存在しない場合は作成
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // ファイルが存在しない場合は新規作成
        let historyData = { users: {} };
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            if (fileContent.trim() !== '') {
                historyData = JSON.parse(fileContent);
            }
        }
        
        // ユーザーデータが存在しない場合は初期化
        if (!historyData.users[userId]) {
            historyData.users[userId] = {
                username: username,
                history: []
            };
        }
        
        // 今日の日付
        const today = new Date().toISOString().split('T')[0];
        
        // 履歴に追加
        historyData.users[userId].history.push({
            date: today,
            type: type,
            result: fortune.luck,
            luckyPoint: fortune.luckyPoint,
            luckyColor: fortune.luckyColor
        });
        
        // 履歴は最大10件まで保存
        if (historyData.users[userId].history.length > 10) {
            historyData.users[userId].history.shift();
        }
        
        // ファイルに保存
        fs.writeFileSync(filePath, JSON.stringify(historyData, null, 2), 'utf8');
        
    } catch (error) {
        console.error('Error saving fortune history:', error);
    }
}