// events/interactionCreate.js
module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // コマンド以外のインタラクションは無視
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`${interaction.commandName}というコマンドは見つかりません。`);
            
            // より詳細なエラー通知
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ 
                    content: `コマンド \`${interaction.commandName}\` は現在利用できません。`,
                    ephemeral: true 
                });
            } else {
                await interaction.reply({ 
                    content: `コマンド \`${interaction.commandName}\` は現在利用できません。`,
                    ephemeral: true 
                });
            }
            return;
        }

        try {
            // タイムアウトを設定
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('インタラクションがタイムアウトしました')), 10000)
            );

            await Promise.race([
                command.execute(interaction),
                timeoutPromise
            ]);
        } catch (error) {
            console.error('コマンド実行エラー:', error);
            
            // より詳細なエラーログ
            console.error('エラー詳細:', {
                command: interaction.commandName,
                user: interaction.user.tag,
                errorMessage: error.message,
                errorStack: error.stack
            });

            // エラーメッセージの送信
            const errorMessage = error.message.length > 0 
                ? `エラーが発生しました: ${error.message}` 
                : 'コマンドの実行中に予期せぬエラーが発生しました。';

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ 
                        content: errorMessage,
                        ephemeral: true 
                    });
                } else {
                    await interaction.reply({ 
                        content: errorMessage,
                        ephemeral: true 
                    });
                }
            } catch (followUpError) {
                console.error('フォローアップメッセージの送信に失敗:', followUpError);
            }
        }
    },
};