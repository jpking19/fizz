var express = require('express');
var router = express.Router();
var mongSetup = require('../mongooseSetup');
var seltzers = require("mongoose").model('seltzers');
var user = require("mongoose").model('user');
var purchases = require("mongoose").model('purchases');

var mongoDB = mongSetup.db;
mongSetup.Promise = global.Promise;

/* GET home page. */
router.get('/', function(req, res, next) {
    var loggedin = false;
    var name = 'not logged';
    // console.log('session name is ' + req.session.name);
    // console.log('session email is ' + req.session.email);
    // console.log('session password is ' + req.session.password);
    if (req.session.name) {
        loggedin = true;
        name = req.session.name;
        user.findOne({
            email: req.session.email,
            password: req.session.password
        }).populate({
            path: 'shoppingCart',
            model: 'seltzers'
        }).then((someUser) => {
            console.log(someUser);
            var isShoppingCart = true;
            var userCart = someUser.shoppingCart;
            console.log("This is the user in /")
            console.log(JSON.stringify(someUser));
            console.log(userCart);
            if (userCart.length == 0)
                isShoppingCart = false;

            seltzers.find().then((allSeltzers) => {
                console.log(JSON.stringify(allSeltzers));
                res.render('index.hbs', {
                    title: "Fizz: Seltzer Reimagined",
                    seltzers: allSeltzers,
                    isLoggedIn: loggedin,
                    isTransactions: false,
                    username: name,
                    cart: userCart,
                    isCart: isShoppingCart
                });
            }, (err) => {
                console.log('Could not get meal data from the server');
                throw err;
            });
        });


    } else {
        seltzers.find().then((allSeltzers) => {
            console.log(JSON.stringify(allSeltzers));
            res.render('index.hbs', {
                title: "Fizz: Seltzer Reimagined",
                seltzers: allSeltzers,
                isLoggedIn: loggedin,
                isTransactions: false,
                username: name
            });
        }, (err) => {
            console.log('Could not get meal data from the server');
            throw err;
        });

    }


});

// Interact with cart (add or delete)
router.get('/getQuantity', function (req, res, next) {
    var seltID = req.query.seltid;
    var addOrDelete = req.query.updateNumber;
    seltzers.findOne({
        seltzerID: seltID
    }).then((selt) => {
        selt.quantity = selt.quantity + parseInt(addOrDelete);
        var numberLeft = selt.quantity;
        console.log("this is the number left " + numberLeft);
        selt.save();
        user.findOne({
            email: req.session.email,
            password: req.session.password
        }).populate({
            path: 'shoppingCart',
            model: 'seltzers'
        }).then((someUser) => {
            if(addOrDelete == -1) {
                someUser.shoppingCart.push(selt);
                someUser.save();
                res.end();
            }else if (addOrDelete == 1) {
                //here we add to quantity and
                //delete from user cart
                for(var i = 0; i < someUser.shoppingCart.length; i++) {
                    if(someUser.shoppingCart[i].seltzerID == seltID) {
                        someUser.shoppingCart.splice(i, 1);
                        break;
                    }
                }
                someUser.save();
                res.end();
            }
        })
    });
});

// Checkout user (add transaction and clear cart)
router.post('/checkout', function(req, res) {
    // Create transaction
    user.findOne({
        email: req.session.email,
        password: req.session.password
    }).populate({
        path: 'shoppingCart',
        model: 'seltzers'
    }).populate({
        path: 'purchases',
        model: 'purchases'
    }).then((someUser) => {
        // Get current date
        date = getDate();

        // iterate through seltzers in cart, sum total & sum products
        var seltzers = [];
        var total = 0;
        for (var i = 0; i < someUser.shoppingCart.length; i++) {
            seltzers.push(someUser.shoppingCart[i]);
            console.log(someUser.shoppingCart[i].price);
            total += someUser.shoppingCart[i].price;
        }

        purchase = {
            date: date,
            total: total,
            seltzers: seltzers
        }

        // Save purchase
        purchases.create({date: date, total: total, items: seltzers}, function (err, doc) {
            console.log(err);

            // Add purchase to user, clear cart
            someUser.purchases.push(doc);
            someUser.shoppingCart = [];
            someUser.save();

            res.end();
        });
    });
});

// Log user out, return to home
router.get('/logout', function(req, res) {
    req.session.destroy(function(err){
        if (err){
            console.log(err);
        }
        else {
            res.redirect('/');
        }
    })
});

router.post('/login', function(req, res, next) {
    console.log("login called " + req.body.email + " "+ req.body.password);
    user.findOne({
        email: req.body.email,
        password: req.body.password
    }).then((user)=>{
            req.session.name = user.name;
            req.session.email = user.email;
            req.session.password = req.body.password;
            console.log(req.session.name + " " + req.session.email + " "+ req.session.password);
            res.end()
    }, (err)=>{
    console.log(err);
    res.status(404).send(("Could not find that user"));
    })
});

router.post('/signup', function(req, res, next){
    console.log("signup called");
    req.session.name= req.body.name;
    req.session.email = req.body.email;
    req.session.password = req.body.password;
   var newUser= new user({
       name: req.body.name,
       email: req.body.email,
       password: req.body.password,
   });

   newUser.save().then((doc)=>{
       console.log(doc);
       res.end();
   }, (e) => {
       console.log("There was an error: ", e);
       throw e;
   });

   console.log(req.session.name)
});

// Helper function to get current time
function getDate() {
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth() + 1;
    var yyyy = today.getFullYear();

    if(dd < 10) {
        dd = '0' + dd;
    }

    if(mm < 10) {
        mm = '0' + mm;
    }

    today = mm + '/' + dd + '/' + yyyy;
    return today;
}

module.exports = router;
