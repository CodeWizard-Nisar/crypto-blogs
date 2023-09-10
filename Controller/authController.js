const Joi = require("joi");
const User = require("../Models/users");

const passwordPattern =
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@#$%^&+=!])(?!.*\s).{8,16}$/;

const authController = {
  async register(req, res, next) {
    // validate user input
    const userRegisterSchema = Joi.object({
      username: Joi.string().min(5).max(30).required(),
      name: Joi.string().max(30).required(),
      email: Joi.string().email().required(),
      password: Joi.string().pattern(passwordPattern).required(),
      confirmPassword: Joi.ref("password"),
    });

    const { error } = userRegisterSchema.validate(req.body);

    //2. if error in validation return error via middleware

    if (error) {
      return next(error);
    }
    //3. if email or username is already registered return an error
    const { username, name, email, password } = req.body;
    //check if email is not already  register

    try {
      const emailInUse = await User.exists({ email });
      const usernameInUse = await User.exists({ username });
      if (emailInUse) {
        const error = {
          status: 409,
          message: "Email adress already registered, use another email adress",
        };
        return next(error);
      }
      if (usernameInUse) {
        const error = {
          status: 409,
          message: "Username not available, choose another different username!",
        };
        return next(error);
      }
    } catch (error) {
      return next(error);
    }
  },
  async login() {},
};

module.exports = authController;
