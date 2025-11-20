import { User } from "../models/users.model.js";
import { asyncHandler } from "../utils/asyncHandler.utils.js";
import { ApiError } from "../utils/ApiError.utils.js";
import { ApiResponse } from "../utils/ApiResponse.utils.js";
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("api-tracer");

const generateAccessAndRefreshTokens = async (userID) => {
  try {
    const user = await User.findById(userID);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Error generating access and refresh tokens");
  }
};


const CreateUser = asyncHandler( async (req, res) => {
    const span = tracer.startSpan("create_user_api");
    try {
        const { userName, email, password } = req.body;
    
        const validationSpan = tracer.startSpan("validate_user_input", { parent: span });
        if (!userName || !email || !password) {
            validationSpan.end();
            throw new ApiError(400, "Username, email, and password are required");
        }
        validationSpan.end();
    
        const existingUser = await User.findOne({ $or: [ { userName }, { email } ] });
        
        if (existingUser) {
            throw new ApiError(400, "User with the given username or email already exists");
        }
    
        const creationSpan = tracer.startSpan("create_user_in_db", { parent: span });
        const newUser = await User.create({ 
            userName, 
            email, 
            password,
            registrationDate: new Date()
        });
        creationSpan.setAttribute("user.id", newUser._id.toString());
        creationSpan.end();
    
        if (!newUser) {
            throw new ApiError(500, "Failed to create user");
        }
    
        const retrievalSpan = tracer.startSpan("retrieve_created_user", { parent: span });
        const createdUser = await User.findById(newUser._id).select("-password -__v");
        retrievalSpan.end();
    
        if (!createdUser) {
            throw new ApiError(500, "Failed to retrieve created user");
        }
    
        span.setAttribute("user.id", createdUser._id.toString());
        span.end();
        return res
            .status(201)
            .json(new ApiResponse(
                201, 
                createdUser, 
                "User created successfully"
            ));
    } catch (error) {
        span.recordException(error);
        res.status(400).json({ error: error.message });
    }finally{
        span.end();
    }
})

const loginUser = asyncHandler( async (req, res) => {
    const span = tracer.startSpan("login_user_api");
    try {
        const loginSpan = tracer.startSpan("login_user_api", { parent: span });
        const { email, password } = req.body;
        loginSpan.setAttribute("user.email", email);

        const validationSpan = tracer.startSpan("validate_login_input", { parent: loginSpan });
        if (!email || !password) {
            validationSpan.end();
            throw new ApiError(400, "Email and password are required");
        }
        validationSpan.end();
    
        const retrievalSpan = tracer.startSpan("retrieve_user_for_login", { parent: loginSpan });
        const user = await User.findOne({ email });
        retrievalSpan.end();
    
        if (!user) {
            throw new ApiError(401, "Invalid email or password");
        }
    
        const passwordValidationSpan = tracer.startSpan("validate_user_password", { parent: loginSpan });
        const isPasswordValid = await user.isPasswordCorrect(password);
        passwordValidationSpan.setAttribute("password.valid", isPasswordValid);
        passwordValidationSpan.end();
    
        if (!isPasswordValid) {
            throw new ApiError(401, "Invalid email or password");
        }
    
        loginSpan.setAttribute("user.id", user._id.toString());

        const tokenSpan = tracer.startSpan("generate_tokens_for_login", { parent: loginSpan });
        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);
        tokenSpan.end();

        loginSpan.end();
        return res
            .status(200)
            .json(new ApiResponse(
                200,
                {
                    accessToken,
                    user,
                    refreshToken
                },
                "Login successful"
            ));
    
    } catch (error) {
        span.recordException(error);
        res.status(400).json({ error: error.message });
    }finally{
        span.end();
    }
});

const logoutUser = asyncHandler( async (req, res) => {
        const span = tracer.startSpan("logout_user_api");
    try {
        const logoutSpan = tracer.startSpan("logout_user_api", { parent: span });
        const userId = req.user._id;
        logoutSpan.setAttribute("user.id", userId.toString());

        const retrievalSpan = tracer.startSpan("retrieve_user_for_logout", { parent: logoutSpan });
        const user = await User.findById(userId);
        retrievalSpan.end();

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const tokenClearSpan = tracer.startSpan("clear_refresh_token", { parent: logoutSpan });
        user.refreshToken = null;
        await user.save({ validateBeforeSave: false });
        tokenClearSpan.end();

        logoutSpan.end();
        return res
            .status(200)
            .json(new ApiResponse(
                200,
                null,
                "Logout successful"
            ));
    } catch (error) {
        span.recordException(error);
        res.status(400).json({ error: error.message });
    } finally {
        span.end();
    }
})


const UpdateUser = asyncHandler( async (req, res) => {
        const span = tracer.startSpan("update_user_api");
    try {
        const updateSpan = tracer.startSpan("update_user_api", { parent: span });
        const userId = req.user._id;
        const { userName, email } = req.body;
        updateSpan.setAttribute("user.id", userId.toString());

        const retrievalSpan = tracer.startSpan("retrieve_user_for_update", { parent: updateSpan });
        const user = await User.findById(userId);
        retrievalSpan.end();

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const validationSpan = tracer.startSpan("validate_update_input", { parent: updateSpan });
        if(!userName || !email){
            validationSpan.end();
            throw new ApiError(400, "Username and email are required");
        }
        validationSpan.end();

        const updateDatabaseSpan = tracer.startSpan("update_user_in_db", { parent: updateSpan });
        const updateUser = await User.findByIdAndUpdate(
            userId,
            { userName, email, lastUpdate: new Date() },
            { new: true, runValidators: true }
        ).select("-password -__v ");
        updateDatabaseSpan.setAttribute("user.name", userName);
        updateDatabaseSpan.setAttribute("user.email", email);
        updateDatabaseSpan.end();

        if (!updateUser) {
            throw new ApiError(500, "Failed to update user");
        }

        updateSpan.end();
        return res
            .status(200)
            .json(new ApiResponse(
                200,
                updateUser,
                "User updated successfully"
            ));
    } catch (error) {
        span.recordException(error);
        res.status(400).json({ error: error.message });
    } finally {
        span.end();
    }
});


const deleteUser = asyncHandler( async (req, res) => {
        const span = tracer.startSpan("delete_user_api");
    try {
        const deleteSpan = tracer.startSpan("delete_user_api", { parent: span });
        const userId = req.user._id;
        deleteSpan.setAttribute("user.id", userId.toString());

        const retrievalSpan = tracer.startSpan("retrieve_user_for_deletion", { parent: deleteSpan });
        const user = await User.findById(userId);
        retrievalSpan.end();

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const deletionSpan = tracer.startSpan("mark_user_as_deleted", { parent: deleteSpan });
        user.isDeleted = true;
        user.deletedAt = new Date();
        await user.save({ validateBeforeSave: false });
        deletionSpan.end();

        deleteSpan.end();
        return res
            .status(200)
            .json(new ApiResponse(
                200,
                null,
                "User deleted successfully"
            ));
    } catch (error) {
        span.recordException(error);
        res.status(400).json({ error: error.message });
    } finally {
        span.end();
    }
});



export { CreateUser, loginUser, logoutUser, UpdateUser, deleteUser };