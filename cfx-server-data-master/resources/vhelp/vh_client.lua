------- CHANGE THESE SETTINGS TO FIT YOUR NEEDS -------

-- Recommended total number of lines is ~13
local helpMessage = {
    'X - Opens ^1Custom Car Menu',
    'M - Opens ^1lambda menu',
    'Discord - discord.gg/yWddFpQ',
    'Website - zivinitygaming.cf',
}
-- Recommended total number of lines is ~13
local rulesMessage = {
    'Do not troll',
    'Do not interact with anyone that does not want to be interacted with',
    'Do not constantly spawn kill',
}

-- Prefixes will be displayed before each line,
local helpPrefix = '^1'
local helpSuffix = '^1.'
local rulesPrefix = '^3'
local rulesSuffix = '^3.'

-- Customize your /help and /rules command, if you wish.
local helpCommand = 'help' -- don't add a "/" here!
local rulesCommand = 'rules' -- don't add a "/" here!
-------------------------------------------------------


















------- CODE, DON'T TOUCH THIS!!! -------
RegisterCommand(helpCommand, function()
    for i in pairs(helpMessage) do
        TriggerEvent('chatMessage', '', {255, 255, 255}, helpPrefix .. helpMessage[i] .. helpSuffix)
    end
end, false)

RegisterCommand(rulesCommand, function()
    for i in pairs(rulesMessage) do
        TriggerEvent('chatMessage', '', {255, 255, 255}, rulesPrefix .. rulesMessage[i] .. rulesSuffix)
    end
end, false)
TriggerEvent('chat:addSuggestion', '/' .. helpCommand, 'Displays a help message.')
TriggerEvent('chat:addSuggestion', '/' .. rulesCommand, 'Displays the server rules.')