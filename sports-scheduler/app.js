const flash = require("connect-flash");
var csrf = require("tiny-csrf");
const { request } = require("http");
const express = require("express");
const app = express();
const { sport, Users, sportsession } = require("./models");
const bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
const path = require("path");
const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const LocalStartegy = require("passport-local");
const bcrypt = require("bcrypt");
const { error } = require("console");
const saltRounds = 10;
app.use(cookieParser("shh!some secret string"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use((req, res, next) => {
  // Log the request method , URL and token
  console.log(
    `Request Method: ${req.method} | Request URL: ${req.url} | CSRF Token: ${req.body._csrf}`
  );
  next();
});
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(flash());

app.use(
  session({
    secret: "my-super-secret-key-017281611164576581653",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, "public")));
app.use(function (request, response, next) {
  response.locals.messages = request.flash();
  next();
});

passport.use(
  new LocalStartegy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (username, password, done) => {
      try {
        const user = await Users.findOne({ where: { email: username } });
        if (!user) {
          return done(null, false, { message: "Email is not registered" });
        }

        const result = await bcrypt.compare(password, user.password);
        if (result) {
          return done(null, user);
        } else {
          return done(null, false, { message: "Invalid password" });
        }
      } catch (error) {
        return done(error); // Pass the error to the 'done' callback
      }
    }
  )
);

passport.serializeUser((user, done) => {
  console.log("serializing user in session", user.id);
  done(null, user.id);
});
passport.deserializeUser((id, done) => {
  Users.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});

app.get("/", async (request, response) => {
  if (request.accepts("html")) {
    response.render("index.ejs", {
      title: "sport-scheduler application",
    });
  } else {
    response.json({});
  }
});

app.get("/login", (request, response) => {
  response.render("login.ejs", {
    title: "Login",
    csrfToken: request.csrfToken(),
  });
});

app.post(
  "/session",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  function (request, response) {
    console.log(request.user);
    response.redirect("/usertype");
  }
);

app.get("/signup", (request, response) => {
  if (request.user) {
    return response.redirect("/login");
  }
  response.render("signup.ejs", {
    title: "Signup",
    csrfToken: request.csrfToken(),
  });
});

app.post("/users", async (request, response) => {
  const { firstName, lastName, email, password } = request.body;

  if (!firstName || !email) {
    request.flash("error", "First name and email are required");
    return response.redirect("/signup");
  }

  if (
    request.body.firstName.length !== 0 &&
    request.body.email.length !== 0 &&
    request.body.password.length === 0
  ) {
    request.flash("error", "Password is required");
    return response.redirect("/signup");
  }

  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
  console.log(hashedPwd);
  try {
    const user = await Users.create({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: hashedPwd,
    });
    request.login(user, (err) => {
      if (err) {
        console.log(err);
      }
      response.redirect("/login");
    });
  } catch (error) {
    request.flash("error", "Email is already registered");
    response.redirect("/signup");
    console.log(error);
  }
});

app.get("/signout", (request, response) => {
  request.logout((err) => {
    if (err) {
      return next(err);
    }
    response.redirect("/");
  });
});

app.get("/cancelsession", async (request, response) => {
  response.redirect("/admin");
});

app.get(
  "/usertype",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const un = await Users.findByPk(request.user.id);
    const username = un.firstName + " " + un.lastName;
    response.render("usertype.ejs", {
      username,
      csrfToken: request.csrfToken(),
    });
  }
);

app.post(
  "/role",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const selectedRole = request.body.role;

    if (selectedRole === "sport_organizer") {
      response.redirect("/admin");
    } else if (selectedRole === "player") {
      response.redirect("/player");
    } else {
      // Handle invalid role selection
      res.status(400).send("Invalid role selection");
    }
  }
);
app.get(
  "/admin",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedInUser = request.user.id;
    const un = await Users.findByPk(request.user.id);
    const username = un.firstName + " " + un.lastName;
    const csports = await sport.getsport(loggedInUser);
    if (request.accepts("html")) {
      response.render("home.ejs", {
        title: "sport-scheduler application",
        csports,
        username,
        csrfToken: request.csrfToken(),
      });
    } else {
      response.json({
        csports,
        username,
      });
    }
  }
);

app.post(
  "/admin",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const { id, sport_name } = request.body;
    console.log(request.body);
    if (!sport_name || !id) {
      request.flash("error", "Id and sport_name are required");
      return response.redirect("/admin");
    }
    try {
      await sport.addsport({
        id: request.body.id,
        sport_name: request.body.sport_name,
        userId: request.user.id,
      });
      return response.redirect("/admin");
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);
app.delete(
  "/admin/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const sportId = request.params.id;
    try {
      await sport.remove(sportId, request.user.id);
      response.json({ success: true });
    } catch (error) {
      console.log(error);
      return response.status(500).json({ error: "Failed to delete sport" });
    }
  }
);
app.get(
  "/create-session",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      const sportName = request.query.sport;

      response.render("create-session.ejs", {
        title: "Create Session",
        sportName: sportName,
        csrfToken: request.csrfToken(),
      });
    } catch (error) {
      // Handle any errors that occur during the process
      console.error(error);
      response.status(500).send("Internal Server Error");
    }
  }
);

app.post(
  "/create-session",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const {
      sport_name,
      venue,
      numberofTeams,
      numberofplayers,
      playerNames,
      time,
    } = request.body;
    console.log("checking:", request.body);
    try {
      await sportsession.addsession({
        venue: venue,
        numberofTeams: numberofTeams,
        numberofplayers: numberofplayers,
        playerNames: playerNames,
        time: time,
        userId: request.user.id,
        sport_name: sport_name,
      });
      return response.redirect("/player");
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

app.get(
  "/player",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const allsports = await sport.getsports();
    try {
      response.render("player", {
        title: "PLAYER",
        allsports: allsports,
        csrfToken: request.csrfToken(),
      });
    } catch (error) {
      // Handle any errors that occur during session retrieval
      console.error(error);
      // Render an error page or redirect to an appropriate route
      response.render("error", { message: "Internal Server Error" });
    }
  }
);

app.get(
  "/sessions",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedInUser = request.user.id;
    const un = await Users.findByPk(request.user.id);
    const username = un.firstName + " " + un.lastName;
    const sportName = request.query.sport;
    const sessions = await sportsession.getsession(sportName);
    console.log(sessions);
    const userIds = sessions.map((session) => session.userId);
    const users = await Users.findAll({
      where: {
        id: userIds,
      },
    });
    console.log(users);
    const usernames = users.map((user) => `${user.firstName} ${user.lastName}`);
    console.log(usernames);
    try {
      response.render("playersession.ejs", {
        title: "Sport Sessions",
        data: sessions,
        username,
        usernames,
        loggedInUser,
        userIds,
        csrfToken: request.csrfToken(),
      });
    } catch (error) {
      console.error(error);
      response.status(500).send("Internal Server Error");
    }
  }
);

app.get(
  "/mysession",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      const userId = request.user.id; // Assuming you have the user ID available in the request object
      const username = request.user.firstName;
      // Fetch sessions created by the logged-in user
      const sessions = await sportsession.findAll({
        where: {
          userId: userId,
        },
      });

      response.render("mysessions.ejs", {
        title: "My Sessions",
        data: sessions,
        username,
        csrfToken: request.csrfToken(),
      });
    } catch (error) {
      console.error(error);
      response.status(500).send("Internal Server Error");
    }
  }
);
app.get("/join", (request, response) => {
  const sessionId = request.query.sessionId;
  const username = request.query.username;
  const loggedInUser = request.user.id;

  // Call the addPlayer function in the SportSession model with the sessionId, username, and loggedInUser
  sportsession
    .addplayer(sessionId, username, loggedInUser)
    .then(() => {
      // Redirect to the joined sessions page
      response.redirect("/joinedsessions");
    })
    .catch((error) => {
      // Handle error
      response.status(500).send("Failed to join the session.");
    });
});

app.get(
  "/playersession",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedInUser = request.user.id;
    const sessionId = request.query.sessionId;
    const userName = request.query.username;
    const un = await Users.findByPk(request.user.id);
    const username = un.firstName + " " + un.lastName;
    const sessions = await sportsession.getsession(sportName);
    console.log(sessions);
    const userIds = sessions.map((session) => session.userId);
    const users = await Users.findAll({
      where: {
        id: userIds,
      },
    });
    console.log(users);
    const usernames = users.map((user) => `${user.firstName} ${user.lastName}`);
    console.log(usernames);
    try {
      response.render("playersession.ejs", {
        title: "Sport Sessions",
        sessionId,
        userName,
        data: sessions,
        username,
        usernames,
        userIds,
        csrfToken: request.csrfToken(),
      });
    } catch (error) {
      console.error(error);
      response.status(500).send("Internal Server Error");
    }
  }
  // Retrieve session data or perform any necessary operations related to the playersession
);

app.get(
  "/joinedsessions",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    // Retrieve the joined sessions for the logged-in user
    const loggedInUser = request.user.id;
    // Use your logic to fetch the joined sessions from the database or any other data source
    const joinedSessions = await sportsession.getjoinedsession(loggedInUser); // Replace `fetchJoinedSessions` with your own implementation
    const userIds = joinedSessions.map((session) => session.userId);
    const users = await Users.findAll({
      where: {
        id: userIds,
      },
    });
    const usernames = users.map((user) => `${user.firstName} ${user.lastName}`);
    // Render the joinedsession.ejs template with the data
    response.render("joinedsessions", {
      title: "Joined Sessions",
      data: joinedSessions,
      loggedInUser: loggedInUser,
      userIds,
      usernames,
      csrfToken: request.csrfToken(),
    });
  }
);

app.get("/cancelsession", (request, response) => {
  response.redirect("/home");
});
module.exports = app;
