const express = require("express");
const router = express.Router();

router.get("/test", (req, res) => res.json({ msg: "working!" }));

//user

//login
// register
//logout
//refresh

//blog
//crud
//create
//read
//read blog by id
//update
//delete

//comment
//create comment
//read comments by blog id

module.exports = router;
