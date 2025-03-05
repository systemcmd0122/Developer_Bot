module.exports = {
    name: 'voiceStateUpdate',
    execute(oldState, newState) {
        const timelogCommand = oldState.client.commands.get('timelog');
        if (timelogCommand && timelogCommand.handleVoiceStateUpdate) {
            timelogCommand.handleVoiceStateUpdate(oldState, newState);
        }
    }
};