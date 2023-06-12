const request = require("supertest");
var cheerio = require("cheerio");
const db = require("../models/index");
const app = require("../app");
const { application } = require("express");

let server, agent;
function extractCsrfToken(res) {
  var $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}

const login = async (agent, username, password) => {
  let res = await agent.get("/login");
  let csrfToken = extractCsrfToken(res);
  res = await agent.post("/session").send({
    email: username,
    password: password,
    _csrf: csrfToken,
  });
}

describe("sports-scheduler Application", function () {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(4000, () => {});
    agent = request.agent(server);
  });
  afterAll(async () => {
    try {
      await db.sequelize.close();
      await server.close();
    } catch (error) {
      console.log(error);
    }
  });
  test("Sign up", async () => {
    let res = await agent.get("/signup");
    const csrfToken = extractCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "Test",
      lastName: "user A",
      email: "user.a@test.com",
      password: "12345678",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });

  test("Sign out", async () => {
    let res = await agent.get("/");
    expect(res.statusCode).toBe(200);
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);
    res = await agent.get("/player");
    expect(res.statusCode).toBe(302);
  });
  
   test(" Creating a sport", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");
    const res = await agent.get("/admin");
    const csrfToken = extractCsrfToken(res);
    const response = await agent.post("/admin").send({
      id:"1",
      sport_name: "football",
      _csrf: csrfToken,
    });
    expect(response.statusCode).toBe(302);
     expect(response.header.location).toBe("/admin");

  // Checking if the sport was added to the database
  const addedSport = await db.sport.findOne({ where: { id: "1" } });
  expect(addedSport).not.toBeNull();
  expect(addedSport.sport_name).toBe("football"); // Assuming the sport_name is stored in lowercase

  // Cleaning up - delete the added sport
  await addedSport.destroy();
  });

});
