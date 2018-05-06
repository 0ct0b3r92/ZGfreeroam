
local Foundation = {"steam:110000110ba80e2","steam:110000108f588bc","ip:192.168.0.3",}
local Administration = {"","","ip:",}
local Moderation = {"","ip:",}
local Development = {"steam:11000010ac4a523","steam:1100001144b463f","ip:",}
local Donator = {"steam:","ip:",}
local Sheriff = {"steam:","ip:",}
local Moderator = {"steam:","ip:",}
local StateTroopers = {"steam:","ip:",}
local Test = {"steam:","ip:",}
local ScriptCreator = {"steam:110000108ce69e8","ip:",}


AddEventHandler('chatMessage', function(Source, Name, Msg)
    args = stringsplit(Msg, " ")
    CancelEvent()
    if string.find(args[1], "/") then
        local cmd = args[1]
        table.remove(args, 1)
    else     
        local player = GetPlayerIdentifiers(Source)[1]
        if has_value(Foundation, player) then
            TriggerClientEvent('chatMessage', -1, "Director | " .. Name, { 41, 242, 205 }, Msg)           
        elseif has_value(Administration, player) then
            TriggerClientEvent('chatMessage', -1, "Administration | " .. Name, { 40, 241, 161 }, Msg)
        elseif has_value(Moderation, player) then
            TriggerClientEvent('chatMessage', -1, "Moderation | " .. Name, { 1, 165, 20 }, Msg)
        elseif has_value(Development, player) then
            TriggerClientEvent('chatMessage', -1, "Development | " .. Name, { 4, 126, 140 }, Msg)
        elseif has_value(Donator, player) then
            TriggerClientEvent('chatMessage', -1, "Donator | " .. Name, { 244, 164, 4 }, Msg)
        elseif has_value(Sheriff, player) then
            TriggerClientEvent('chatMessage', -1, "Sheriff's Department | " .. Name, { 0, 0, 255 }, Msg)
	    elseif has_value(Moderator, player) then
            TriggerClientEvent('chatMessage', -1, "Moderator | " .. Name, { 0, 255, 247 }, Msg)
        elseif has_value(StateTroopers, player) then
            TriggerClientEvent('chatMessage', -1, "State Troopers | " .. Name, { 222, 0, 255 }, Msg)
		elseif has_value(Test, player) then
            TriggerClientEvent('chatMessage', -1, "State Troopers | Admin " .. Name, { 222, 0, 255 }, Msg)
		elseif has_value(ScriptCreator, player) then
            TriggerClientEvent('chatMessage', -1, "Chat Roles Creator | " .. Name, { 0, 255, 43 }, Msg)
        else
            TriggerClientEvent('chatMessage', -1, "Player | " .. Name, { 122, 41, 209 }, Msg)
        end
            
    end
end)

function has_value (tab, val)
    for index, value in ipairs(tab) do
        if value == val then
            return true
        end
    end

    return false
end

function stringsplit(inputstr, sep)
    if sep == nil then
        sep = "%s"
    end
    local t={} ; i=1
    for str in string.gmatch(inputstr, "([^"..sep.."]+)") do
        t[i] = str
        i = i + 1
    end
    return t
end