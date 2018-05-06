var config = 
{    
    /* 
        Relative path the the logo we want to display.
    */
    image: "img/logo.png",

    /*
        How big should the logo be?
        The values are: [width, height].
        Recommended to use square images less than 1024px.
    */
    imageSize: [512, 512],

    /*
        Define the progressbar type
            0 = Single progressbar
            1 = Multiple progressbars
            2 = Collapsed progressbars
     */
    progressBarType: 0,

    /*
        Here you can disable some of progressbars.
        Only applys if `singleProgressbar` is false.
    */
    progressBars:
    {
        "INIT_CORE": {
            enabled: false, //NOTE: Disabled because INIT_CORE seems to not get called properly. (race condition).
        },

        "INIT_BEFORE_MAP_LOADED": {
            enabled: true,
        },

        "MAP": {
            enabled: true,
        },

        "INIT_AFTER_MAP_LOADED": {
            enabled: true,
        },

        "INIT_SESSION": {
            enabled: true,
        }
    },

    /*
        Loading messages will be randomly picked from the array.
        The message is located on the left side above the progressbar.
        The text will slowly fade in and out, each time with another message.
        You can use UTF-8 emoticons inside loading messages! 
    */
    loadingMessages: 
    [
        "Don't you dare disrespect the staff &#x1f40c;",
        "Website - zivinitygaming.ga &#x1f40c;",
        "Discord - discord.gg/yWddFpQ &#x1f40c; &#x1f528;",
        "Your playing FiveM right now &#x1f40c; &#x1f462;",
        "Gta5Police? What's that?.. &#x1f41a.",
        "Entering Our Shit Servers &#x1f3cf",
        "Entering Our Shit Servers &#x1f9e0;",
        "Join the discord cunt &#x1f956;",
        "You remember SAMP? Good times... &#x1f374;",
        "Zua is snailsome! &#x1f60d;",
        "Zua is the Best",
        "Website - zivinitygaming.ga &#x1f697;",
        "Discord - discord.gg/yWddFpQ &#x1f3cc;",
        "Zua is a good looking guy &#x1f4f1;",
        "Entering Our Shit Servers  &#x1f691;",
        "Some stuff made by Rick",
        "What's this? A website! zivinitygamin.ga",
        ":3"
    ],

    /*
        Rotate the loading message every 5000 milliseconds (default value).
    */
    loadingMessageSpeed: 4 * 1000,

    /*
        Array of music id's to play in the loadscreen.
        Enter your youtube video id's here. In order to obtain the video ID
        Take whats after the watch?v= on a youtube link.
        https://www.youtube.com/watch?v=<videoid>
        Do not include the playlist id or anything, it should be a 11 digit code.
        
        Do not use videos that:
            - Do not allow embedding.
            - Copyrighted music (youtube actively blocks this).
    */
    music:
    [
        "AINGJmnwMic", "sT_VcU_jOEM", "PVfjOjiBUkc", "vWdjWYhEONA",
        "HcJHr_8i-PY", "HCXW-Wbfn4U", "E1nBw1IwCI8", "wzAq_wbVT9A",
        "KeuPv9lN6zI", "IEZ6JHezCAw", "kGh7spYm2fs", "wLo2RvLU57c",
        "NYuhye3AYSY", "u3xqpu7v8jU", "UTBuH5ZNnJQ", "vWdjWYhEONA",
        "FYW1Y4EEA2Y", "E-4Dtd6mC-c", "zQnj66Xuajs", "8OgHDck_vT0",
        "kUdCNdd9n28", "qDUH3PUoYtw", "SoMeB4QBVug", "8sV6AT6jVuI"
    ],


    /*
        Set to false if you do not want any music.
    */
    enableMusic: true,

    /*
        Default volume for the player. Please keep this under 50%, to not blowout someones eardrums x)
     */
    musicVolume: 10,

    /*
        Should the background change images?
        True: it will not change backgrounds.
        False: it will change backgrounds.
    */
    staticBackground: false,
    
    /*
        Array of images you'd like to display as the background.
        Provide a path to a local image, using images via url is not recommended.
    */
    background: 
    [
        "img/bg1.jpg",
        "img/bg2.jpg",
        "img/bg3.jpg",
        "img/bg4.jpg",
        "img/bg5.jpg",
        "img/bg6.jpg",
        "img/bg7.jpg"
    ],

    /*
        Time in milliseconds on how fast the background
        should swap images.
     */
    backgroundSpeed: 9 * 1000,
}
