const { Events, EmbedBuilder } = require('discord.js');
const { firefox } = require('playwright');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Botのメッセージは無視
        if (message.author.bot) return;

        // 返信ではない場合は無視
        if (!message.reference) return;

        // "画像検索"というメッセージかどうかをチェック
        if (message.content.toLowerCase() !== '画像検索') return;

        try {
            // 返信元のメッセージを取得
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
            
            // 返信元のメッセージに添付画像がない場合
            if (repliedMessage.attachments.size === 0) {
                await message.reply({
                    content: '返信元のメッセージに画像が添付されていません。'
                });
                return;
            }

            // 待機中のメッセージを送信
            const waitingMsg = await message.reply({
                content: '🔍 画像を検索中です...'
            });

            // 最初の添付画像を取得
            const attachment = repliedMessage.attachments.first();
            
            // 画像ファイルでない場合
            if (!attachment.contentType || !attachment.contentType.startsWith('image/')) {
                await waitingMsg.edit({
                    content: 'これは画像ファイルではありません。'
                });
                return;
            }

            // 一時ディレクトリの作成
            const tempDir = path.join(__dirname, '../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // 画像をダウンロード
            const imagePath = path.join(tempDir, `image_${Date.now()}_${attachment.name}`);
            const writer = fs.createWriteStream(imagePath);
            
            const response = await axios({
                url: attachment.url,
                method: 'GET',
                responseType: 'stream'
            });
            
            response.data.pipe(writer);
            
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            console.log(chalk.green(`✓ 画像をダウンロードしました: ${imagePath}`));

            // Playwrightを使用してGoogle画像検索を実行
            const searchResults = await searchImageWithPlaywright(imagePath);
            
            // 検索結果がない場合
            if (!searchResults || searchResults.length === 0) {
                await waitingMsg.edit({
                    content: '画像検索結果が見つかりませんでした。'
                });
                // ダウンロードした画像を削除
                fs.unlinkSync(imagePath);
                return;
            }

            // 検索結果を表示（最大5件）
            const resultsToShow = searchResults.slice(0, 5);
            
            const embed = new EmbedBuilder()
                .setTitle('🔍 画像検索結果')
                .setDescription(`${attachment.name} の検索結果です（最大5件表示）`)
                .setColor('#4285F4') // Google色
                .setThumbnail(attachment.url)
                .setTimestamp();

            // 検索結果をフィールドに追加
            resultsToShow.forEach((result, index) => {
                embed.addFields({
                    name: `検索結果 ${index + 1}`,
                    value: `[${result.title || 'タイトルなし'}](${result.url})\n${result.description || '説明なし'}`
                });
            });

            // 検索結果をメッセージで送信
            await waitingMsg.edit({
                content: null,
                embeds: [embed]
            });

            // ダウンロードした画像を削除
            fs.unlinkSync(imagePath);
            console.log(chalk.green(`✓ 一時画像を削除しました: ${imagePath}`));

        } catch (error) {
            console.error(chalk.red('画像検索中にエラーが発生しました:'), error);
            try {
                await message.reply({
                    content: '画像検索中にエラーが発生しました。時間をおいて再度お試しください。'
                });
            } catch (replyError) {
                console.error(chalk.red('エラーメッセージの送信に失敗しました:'), replyError);
            }
        }
    }
};

/**
 * Playwrightを使用してGoogle画像検索を実行する関数
 * @param {string} imagePath - 検索する画像のパス
 * @returns {Promise<Array>} - 検索結果の配列
 */
async function searchImageWithPlaywright(imagePath) {
    let browser = null;
    
    try {
        console.log(chalk.blue('Playwrightブラウザを起動中...'));
        
        // Firefoxブラウザのインスタンスを作成（ヘッドレスモード）
        browser = await firefox.launch({
            headless: true,
            args: ['--disable-dev-shm-usage']
        });
        
        // 新しいブラウザコンテキストを作成
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            viewport: { width: 1280, height: 800 }
        });
        
        // 新しいページを作成
        const page = await context.newPage();
        
        // Google画像検索ページに移動
        await page.goto('https://www.google.com/imghp');
        
        // cookieダイアログがあれば閉じる
        try {
            const cookieAcceptSelector = 'button:has-text("Accept all")';
            if (await page.isVisible(cookieAcceptSelector, { timeout: 3000 })) {
                await page.click(cookieAcceptSelector);
            }
        } catch (e) {
            // cookieダイアログがない場合は無視
            console.log(chalk.yellow('Cookieダイアログはありませんでした'));
        }
        
        // カメラアイコンをクリック
        await page.click('a[aria-label="Search by image"]');
        
        // 画像をアップロード
        const fileInput = await page.waitForSelector('input[type="file"]');
        await fileInput.setInputFiles(imagePath);
        
        // 検索結果を待つ
        await page.waitForLoadState('networkidle');
        
        // "Visually similar images" セクションが表示されるまで待機
        await page.waitForSelector('div.g', { timeout: 10000 }).catch(() => {
            console.log(chalk.yellow('通常の検索結果セクションが見つかりませんでした'));
        });
        
        // 検索結果を取得
        const results = await page.evaluate(() => {
            const searchResults = [];
            
            // 標準の検索結果を取得
            document.querySelectorAll('div.g').forEach(item => {
                const titleElement = item.querySelector('h3');
                const linkElement = item.querySelector('a');
                const descriptionElement = item.querySelector('div[data-sncf="1"]');
                
                if (titleElement && linkElement) {
                    searchResults.push({
                        title: titleElement.textContent,
                        url: linkElement.href,
                        description: descriptionElement ? descriptionElement.textContent : ''
                    });
                }
            });
            
            return searchResults;
        });
        
        console.log(chalk.green(`✓ ${results.length} 件の検索結果を取得しました`));
        
        return results;
        
    } catch (error) {
        console.error(chalk.red('画像検索の実行中にエラーが発生しました:'), error);
        return [];
    } finally {
        // ブラウザを閉じる
        if (browser) {
            await browser.close();
            console.log(chalk.blue('Playwrightブラウザを終了しました'));
        }
    }
}