const { ActivityType } = require('discord.js');
const chalk = require('chalk');
const os = require('os');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        client.user.setActivity('正常に稼働中', { type: ActivityType.Playing });
        
        const memoryUsage = process.memoryUsage();
        const systemInfo = {
            memory: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
            cpu: os.cpus()[0].model,
            platform: `${os.type()} ${os.release()}`
        };

        console.log(chalk.cyan('\n═══════════════ BOT ONLINE ═══════════════'));
        console.log(chalk.green(`✓ Logged in as: ${chalk.white(client.user.tag)}`));
        console.log(chalk.green(`✓ Servers: ${chalk.white(client.guilds.cache.size)}`));
        console.log(chalk.green(`✓ Users: ${chalk.white(client.users.cache.size)}`));
        console.log(chalk.green(`✓ Memory: ${chalk.white(systemInfo.memory + ' MB')}`));
        console.log(chalk.green(`✓ System: ${chalk.white(systemInfo.platform)}`));
        console.log(chalk.cyan('═════════════════════════════════════════\n'));

        const stats = {
            commands: client.commands.size,
            events: client.eventNames().length
        };
        
        console.log(chalk.yellow('📊 Statistics'));
        console.log(chalk.green(`  ✓ Commands loaded: ${chalk.white(stats.commands)}`));
        console.log(chalk.green(`  ✓ Events registered: ${chalk.white(stats.events)}`));
        console.log(chalk.cyan('═════════════════════════════════════════\n'));
    },
};