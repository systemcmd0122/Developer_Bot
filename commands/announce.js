const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('サーバー内にお知らせを送信します（管理者限定）')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('send')
                .setDescription('新しいお知らせを送信します')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('お知らせを送信するチャンネル')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('お知らせのタイトル')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('お知らせの本文')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('埋め込みの色（16進数カラーコード、例: #FF0000）')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('image')
                        .setDescription('埋め込みに表示する画像のURL（任意）')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('ping')
                        .setDescription('メンバー全員にping通知するかどうか')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('既存のお知らせを編集します')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('編集するお知らせのメッセージID')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('新しいタイトル')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('新しい本文')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('新しい色（16進数カラーコード、例: #FF0000）')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('image')
                        .setDescription('新しい画像URL')
                        .setRequired(false))),
    
    async autocomplete(interaction) {
        const announcements = await this.getAnnouncements(interaction.guild.id);
        const focusedValue = interaction.options.getFocused();
        const filtered = announcements.filter(announcement => 
            announcement.messageId.startsWith(focusedValue) || 
            announcement.title.includes(focusedValue)
        ).slice(0, 25);

        await interaction.respond(
            filtered.map(announcement => ({
                name: `${announcement.title.substring(0, 50)}... (${announcement.messageId})`,
                value: announcement.messageId,
            })),
        );
    },

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        if (interaction.options.getSubcommand() === 'send') {
            await this.handleSend(interaction);
        } else if (interaction.options.getSubcommand() === 'edit') {
            await this.handleEdit(interaction);
        }
    },

    async handleSend(interaction) {
        try {
            const channel = interaction.options.getChannel('channel');
            const title = interaction.options.getString('title');
            const message = interaction.options.getString('message');
            const color = interaction.options.getString('color') || '#3498db';
            const imageUrl = interaction.options.getString('image');
            const shouldPing = interaction.options.getBoolean('ping') || false;

            const colorHex = this.validateColor(color);
            
            const embed = new EmbedBuilder()
                .setColor(colorHex)
                .setTitle(title)
                .setDescription(message)
                .setTimestamp()
                .setFooter({ 
                    text: `${interaction.user.username} からのお知らせ`, 
                    iconURL: interaction.user.displayAvatarURL() 
                });

            if (imageUrl) {
                embed.setImage(imageUrl);
            }

            const content = shouldPing ? '@everyone' : '';

            const announcementMsg = await channel.send({
                content,
                embeds: [embed]
            });

            await this.saveAnnouncement({
                guildId: interaction.guild.id,
                channelId: channel.id,
                messageId: announcementMsg.id,
                title: title,
                message: message,
                color: colorHex,
                imageUrl: imageUrl,
                createdAt: new Date().toISOString(),
                createdBy: interaction.user.id
            });

            await interaction.editReply({
                content: `お知らせを ${channel} に送信しました。`, 
                ephemeral: true
            });
        } catch (error) {
            console.error('お知らせ送信エラー:', error);
            await interaction.editReply({
                content: `お知らせの送信中にエラーが発生しました: ${error.message}`, 
                ephemeral: true
            });
        }
    },

    async handleEdit(interaction) {
        try {
            const messageId = interaction.options.getString('message_id');
            const title = interaction.options.getString('title');
            const message = interaction.options.getString('message');
            const color = interaction.options.getString('color');
            const imageUrl = interaction.options.getString('image');

            const announcements = await this.getAnnouncements(interaction.guild.id);
            const announcement = announcements.find(a => a.messageId === messageId);

            if (!announcement) {
                return await interaction.editReply({
                    content: 'お知らせが見つかりませんでした。', 
                    ephemeral: true
                });
            }

            const channel = await interaction.guild.channels.fetch(announcement.channelId);
            let announcementMsg;
            try {
                announcementMsg = await channel.messages.fetch(messageId);
            } catch (e) {
                return await interaction.editReply({
                    content: 'メッセージが見つかりませんでした。削除された可能性があります。', 
                    ephemeral: true
                });
            }

            const embed = EmbedBuilder.from(announcementMsg.embeds[0]);
            
            if (title) embed.setTitle(title);
            if (message) embed.setDescription(message);
            if (color) {
                const colorHex = this.validateColor(color);
                embed.setColor(colorHex);
                announcement.color = colorHex;
            }
            if (imageUrl) {
                embed.setImage(imageUrl);
                announcement.imageUrl = imageUrl;
            }

            embed.setFooter({
                text: `${interaction.user.username} によって編集されたお知らせ`, 
                iconURL: interaction.user.displayAvatarURL()
            });

            await announcementMsg.edit({
                embeds: [embed]
            });

            if (title) announcement.title = title;
            if (message) announcement.message = message;
            announcement.updatedAt = new Date().toISOString();
            announcement.updatedBy = interaction.user.id;

            await this.updateAnnouncement(interaction.guild.id, announcement);

            await interaction.editReply({
                content: `お知らせを編集しました。`, 
                ephemeral: true
            });
        } catch (error) {
            console.error('お知らせ編集エラー:', error);
            await interaction.editReply({
                content: `お知らせの編集中にエラーが発生しました: ${error.message}`, 
                ephemeral: true
            });
        }
    },

    validateColor(color) {
        if (!color.startsWith('#')) {
            color = `#${color}`;
        }
        
        const colorRegex = /^#[0-9A-Fa-f]{6}$/;
        if (!colorRegex.test(color)) {
            return '#3498db';
        }
        
        return color;
    },
    
    async getAnnouncements(guildId) {
        try {
            const dataPath = path.join(__dirname, '..', 'data', `announcements-${guildId}.json`);
            
            if (!fs.existsSync(dataPath)) {
                return [];
            }
            
            const data = fs.readFileSync(dataPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('お知らせ読み込みエラー:', error);
            return [];
        }
    },
    
    async saveAnnouncement(announcement) {
        try {
            const dataPath = path.join(__dirname, '..', 'data');
            const filePath = path.join(dataPath, `announcements-${announcement.guildId}.json`);
            
            if (!fs.existsSync(dataPath)) {
                fs.mkdirSync(dataPath, { recursive: true });
            }
            
            let announcements = [];
            
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                announcements = JSON.parse(data);
            }
            
            announcements.push(announcement);
            
            fs.writeFileSync(filePath, JSON.stringify(announcements, null, 2), 'utf8');
        } catch (error) {
            console.error('お知らせ保存エラー:', error);
            throw error;
        }
    },
    
    async updateAnnouncement(guildId, updatedAnnouncement) {
        try {
            const filePath = path.join(__dirname, '..', 'data', `announcements-${guildId}.json`);
            
            if (!fs.existsSync(filePath)) {
                throw new Error('お知らせファイルが見つかりません');
            }
            
            const data = fs.readFileSync(filePath, 'utf8');
            let announcements = JSON.parse(data);
            
            const index = announcements.findIndex(a => a.messageId === updatedAnnouncement.messageId);
            
            if (index === -1) {
                throw new Error('更新対象のお知らせが見つかりません');
            }
            
            announcements[index] = updatedAnnouncement;
            
            fs.writeFileSync(filePath, JSON.stringify(announcements, null, 2), 'utf8');
        } catch (error) {
            console.error('お知らせ更新エラー:', error);
            throw error;
        }
    }
};