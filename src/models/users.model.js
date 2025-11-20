import {mongoose, Schema} from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema =  new Schema({
    userName: {
        type: String, 
        required: true, 
        unique: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    },

    lastUpdate: {
        type: Date,
        default: Date.now
    },

    registrationDate: {
        type: Date,
        default: Date.now
    },

    deletedAt: {
        type: Date,
        default: null
    },

    isDeleted: {
        type: Boolean,
        default: false
    },

    refreshToken : {
        type : String,
        default : null
    }

}, {timestamps: true}
)

userSchema.pre("save", async function(next){
    if(!this.isModified('password')) return next();

    this.password = await bcrypt.hash( this.password, 10 )
    next();
})

userSchema.methods.isPasswordCorrect = async function(password) {
    return await bcrypt.compare(password, this.password);
}

userSchema.methods.generateAccessToken = function() {
    return jwt.sign(
        {
            _id: this._id,
            email : this.email,
            username : this.username,
            fullName : this.fullName
        },
            process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn : process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = function() {
    return jwt.sign(
        {
            _id: this._id
        },
            process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn : process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = mongoose.model("User", userSchema);