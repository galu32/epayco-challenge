module.exports = async (router, app) => {

    console.log("Initializing WEB API");

    let express = require("express");

    let here = (folder) => require("path").join(__dirname, folder);

    let session = require("express-session");
    let { v4: uuidv4 } = require("uuid");

    router.use(session({
        secret: "asdfghjklpoiuytrewq",
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false },
        genid: () => {
            return uuidv4();
        }
    }));

    router.use(express.json());
    router.use("/plugins", express.static(here("plugins")));
    router.use("/components", express.static(here("components")));
    router.use("/app", express.static(here("app.js")));
    app.engine("pug", require("pug").__express);
    app.set("views", here("views"));
    app.set("view engine", "pug");

    router.get("/", (req,res) => {
        res.render("index", {
            id: req.session.id
        });
    });

};