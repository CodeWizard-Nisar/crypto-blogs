const Joi = require("joi");
const User = require("../Models/user");
const bcrypt = require("bcryptjs");
const UserDTO = require("../dto/user");
const JWTService = require("../services/JWTService");
const RefreshToken = require("../Models/token");

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
    //password hashing
    const hashedPassword = await bcrypt.hash(password, 10);

    //store user data in database
    let accessToken;
    let refreshToken;
    let user;
    try {
      const userToRegister = new User({
        username,
        name,
        email,
        password: hashedPassword,
      });
      user = await userToRegister.save();

      //token genration
      accessToken = JWTService.signAccessToken({ _id: user._id }, "30m");

      refreshToken = JWTService.signRefreshToken({ _id: user._id }, "60m");
    } catch (error) {
      return next(error);
    }

    //store refresh token in database
    await JWTService.storeRefreshToken(refreshToken, user._id);

    res.cookie("accessToken", accessToken, {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
    });

    //send token in cookies
    res.cookie("refreshToken", refreshToken, {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
    });

    //6. response send
    const userDto = new UserDTO(user);
    return res.status(201).json({ user: userDto, auth: true });
  },

  //Login function

  async login(req, res, next) {
    const userLoginSchema = Joi.object({
      username: Joi.string().min(5).max(30).required(),
      password: Joi.string().pattern(passwordPattern),
    });
    const { error } = userLoginSchema.validate(req.body);
    if (error) {
      return next(error);
    }
    const { username, password } = req.body;

    //const username = req.body.username;
    let user;

    try {
      //match usernae
      user = await User.findOne({ username });
      if (!user) {
        const error = {
          status: 401,
          message: "User Not Found",
        };
        return next(error);
      }
      //match password
      //req.body.password
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        const error = {
          status: 401,
          message: "invalid password",
        };
        return next(error);
      }
    } catch (error) {
      return next(error);
    }

    const accessToken = JWTService.signAccessToken({ _id: user._id }, "30m");
    const refreshToken = JWTService.signRefreshToken({ _id: user._id }, "60m");

    //update refresh token in database
    try {
      await RefreshToken.updateOne(
        {
          _id: user._id,
        },
        { token: refreshToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    res.cookie("accessToken", accessToken, {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
    });
    res.cookie("refreshToken", refreshToken, {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
    });
    const userDto = new UserDTO(user);
    return res.status(200).json({ user: userDto, auth: true });
  },
  async logout(req, res, next) {
    console.log(req);
    //delete refresh token from db
    const { refreshToken } = req.cookies;
    try {
      await RefreshToken.deleteOne({ token: refreshToken });
    } catch (error) {
      return next(error);
    }
    //delete cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    //2/response
    res.status(200).json({ user: null, auth: false });
  },
  async refresh(req, res, next) {
    //1. get refresh token from cookies
    //2.verify refresh token
    //3.generate new token
    //4.update db,return response

    const originalRefreshToken = req.cookies.refreshToken;
    let id;
    try {
      id = JWTService.verifyRefreshToken(originalRefreshToken)._id;
    } catch (e) {
      const error = {
        status: 401,
        message: "unauthorized",
      };
      return next(error);
    }
    try {
      const match = RefreshToken.findOne({
        _id: id,
        token: originalRefreshToken,
      });
      if (!match) {
        const error = {
          status: 401,
          message: "unauthorized",
        };
      }
    } catch (e) {
      return next(e);
    }
    try {
      const accessToken = JWTService.signAccessToken({ _id: id }, "30m");
      const refreshToken = JWTService.signRefreshToken({ _id: id }, "60m");

      await RefreshToken.updateOne({ _id: id }, { token: refreshToken });

      res.cookie("accessToken", accessToken, {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
      });
      res.cookie("refreshToken", refreshToken, {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
      });
    } catch (e) {
      return next(e);
    }
    const user = await User.findOne({ _id: id });

    const userDto = new UserDTO(user);

    res.status(200).json({ user: userDto, auth: true });
  },
};

module.exports = authController;
