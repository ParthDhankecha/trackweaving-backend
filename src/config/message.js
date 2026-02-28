module.exports = {
    message: {
        BAD_REQUEST: {
            code: "E_BAD_REQUEST",
            message: "The request cannot be fulfilled due to bad syntax",
            status: 400
        },
        SERVER_ERROR: {
            code: "E_INTERNAL_SERVER_ERROR",
            message: "Something bad happened on the server",
            status: 500
        },
        CONFIG_UPDATED: {
            code: "OK",
            message: "Configuration updated successfully.",
            status: 200
        },
        CONFIG_NOT_FOUND: {
            code: "E_NOT_FOUND",
            message: "Something missing in configuration details.",
            status: 404
        },
        OK: {
            code: "OK",
            message: "Operation is successfully executed",
            status: 200
        },
        CREATED: {
            code: "CREATED",
            message: "The request has been fulfilled and resulted in a new resource being created",
            status: 201
        },
        CREATE_FAILED: {
            code: "CREATE_FAILED",
            message: "The request has not been fulfilled, Please try again.",
            status: 500
        },
        INVALID_TOKEN: {
            code: "E_BAD_REQUEST",
            message: "Invalid token.",
            status: 400
        },
        TOKEN_EXPIRED: {
            code: "E_UNAUTHORIZED",
            message: "Your current session was expired. Please try to login again.",
            status: 401
        },
        UNAUTHORIZED: {
            code: "E_UNAUTHORIZED",
            message: "Missing or invalid authentication token.",
            status: 401
        },
        LOGIN: {
            code: "OK",
            message: "Successfully login.",
            status: 200
        },
        INVALID_CREDENTIALS: {
            code: "E_BAD_REQUEST",
            message: "Invalid credentials.",
            status: 400
        },
        FILE_MISSING: {
            code: "E_BAD_REQUEST",
            message: "The request has not been fulfilled, Please try again with file upload.",
            status: 400
        },
        FILE_TOO_LARGE: {
            code: "FILE_TOO_LARGE",
            message: "File size too large, Please upload appropriate file.",
            status: 400
        },
        FILE_LIMIT_EXCEEDED: {
            code: "FILE_LIMIT_EXCEEDED",
            message: "File limit exceeded, Please upload file with limitation.",
            status: 400
        },
        FILE_LIMIT_EXCEEDED_OR_FIELD_UNEXPECTED: {
            code: "FILE_LIMIT_EXCEEDED",
            message: "Unexpected file or field.",
            status: 400
        },
        INVALID_MIME_TYPE: {
            code: "E_BAD_REQUEST",
            message: "Invalid selected file type. Select valid file type.",
            status: 400
        },






        USER_NOT_FOUND: {
            code: "E_USER_NOT_FOUND",
            message: "User not found with specified credentials.",
            status: 404
        },
        USER_REGISTERED: {
            code: "CREATED",
            message: "User registered successfully.",
            status: 201
        },
        USER_REGISTER_FAILED: {
            code: "E_INTERNAL_SERVER_ERROR",
            message: "Failed to create User, Please try again later.",
            status: 500
        },
        USER_NOT_DELETED: {
            code: "UNPROCESSABLE_ENTITY",
            message: "User not deleted. Please try again.",
            status: 422
        },
        USER_NOT_UPDATED: {
            code: "UNPROCESSABLE_ENTITY",
            message: "User not updated. Please try again.",
            status: 422
        },
        USER_LIMIT_EXCEEDED: {
            code: "UNPROCESSABLE_ENTITY",
            message: "You already reached maximum user add limit.",
            status: 422
        },
        ACCESS_DENIED: {
            code: "E_FORBIDDEN",
            message: "Access denied.",
            status: 403
        },
        PLAN_NOT_FOUND: {
            code: "E_NOT_FOUND",
            message: "Plan not found. Please try again.",
            status: 404
        },
        PLAN_EXPIRED: {
            code: "E_NOT_FOUND",
            message: "Plan is expired, Please renew it to continue.",
            status: 404
        },
        INACTIVE_ACCOUNT: {
            code: "E_UNAUTHORIZED",
            message: "Your account is inactive. Please contact to admin.",
            status: 401
        },







        EMAIL_NOT_FOUND: {
            code: "E_NOT_FOUND",
            message: "Email not registered, Please register it first.",
            status: 404
        },
        EMAIL_ALREADY_REGISTERED: {
            code: "E_DUPLICATE",
            message: "Email already registered.",
            status: 409
        },
        EMAIL_VERIFIED: {
            code: "OK",
            message: "Your email is verified. Please try to login.",
            status: 200
        },
        EMAIL_NOT_VERIFIED: {
            code: "E_UNAUTHORIZED",
            message: "Your email is not verified. Please check your email and verify it's first.",
            status: 401
        },
        EMAIL_ALREADY_VERIFIED: {
            code: "UNPROCESSABLE_ENTITY",
            message: "Your email already verified. Please try to login.",
            status: 422
        },
        VERIFICATION_FAILED: {
            code: "UNPROCESSABLE_ENTITY",
            message: "Verification of email address failed. Please try again with new verification link.",
            status: 422
        },
        VERIFICATION_TOKEN_EXPIRED: {
            code: "UNPROCESSABLE_ENTITY",
            message: "Verification email link expired. Please get new one.",
            status: 422
        },
        RESEND_VERIFICATION_MAIL_SUCCESS: {
            code: "OK",
            message: "Verification email sent successfully.",
            status: 200
        },
        EMAIL_NOT_SENT: {
            code: "UNPROCESSABLE_ENTITY",
            message: "WE can't send mail, check you have enter live mailing address.",
            status: 422
        },
        OTP_NOT_VALID: {
            code: "E_UNAUTHORIZED",
            message: "Your OTP is not valid or has been expired.",
            status: 401
        },
        MOBILE_OTP_SENT: {
            code: "OK",
            message: "Mobile OTP sent successfully.",
            status: 200
        },
        MOBILE_OTP_NOT_VERIFIED: {
            code: "UNPROCESSABLE_ENTITY",
            message: "Mobile OTP not verified. Please try again.",
            status: 422
        },
        MOBILE_OTP_VERIFIED: {
            code: "OK",
            message: "Mobile OTP verified successfully.",
            status: 200
        },
        MOBILE_NOT_FOUND: {
            code: "E_NOT_FOUND",
            message: "Mobile number not registered, Please register it first.",
            status: 404
        },










        IS_REQUIRED: {
            code: "UNPROCESSABLE_ENTITY",
            message: "is required.",
            status: 422
        },
        IS_DUPLICATE: {
            code: "UNPROCESSABLE_ENTITY",
            message: "already exists.",
            status: 422
        },
        USER_EXISTS: {
            code: "E_DUPLICATE",
            message: "User with this username already exists.",
            status: 409
        },
        REQUIRED_FIELD_MISSING: {
            code: "UNPROCESSABLE_ENTITY",
            message: "Required field missing.",
            status: 422
        },
        NOT_FOUND: {
            code: "E_NOT_FOUND",
            message: "The requested resource could not be found but may be available again in the future",
            status: 404
        },
        RECORD_NOT_FOUND: {
            code: "E_NOT_FOUND",
            message: "Record not found",
            status: 404
        },
        LOGOUT: {
            code: "OK",
            message: "Successfully logout.",
            status: 200
        },
        OPERATION_NOT_PERMITTED: {
            code: "UNPROCESSABLE_ENTITY",
            message: "You do not have enough permission for this operation.",
            status: 422
        },
        USER_UPDATED: {
            code: "OK",
            message: "User updated successfully.",
            status: 200
        },
        USER_DELETED: {
            code: "OK",
            message: "User deleted successfully.",
            status: 200
        },
        RESET_PASSWORD_EMAIL_SENT: {
            code: "OK",
            message: "Reset password email sent successfully.",
            status: 200
        },
        RESET_PASSWORD_SUCCESS: {
            code: "OK",
            message: "Password changed successfully.",
            status: 200
        },
        RESET_PASSWORD_LINK_INVALID: {
            code: "E_BAD_REQUEST",
            message: "Reset password link is expired or invalid, Please re-get it",
            status: 400
        },
        RESET_PASSWORD_LINK_EXPIRED: {
            code: "UNPROCESSABLE_ENTITY",
            message: "Reset password link is expired, Please try again.",
            status: 422
        },
        NOT_ADMIN_PERMISSION: {
            code: "E_UNAUTHORIZED",
            message: "You do not have enough permission to access this resource.",
            status: 401
        },
        NOT_DELETED: {
            code: "UNPROCESSABLE_ENTITY",
            message: "The requested resource could not be deleted or found. Please try again.",
            status: 422
        },
        NOT_UPDATED: {
            code: "UNPROCESSABLE_ENTITY",
            message: "The requested resource could not be updated or found. Please try again.",
            status: 422
        },
        YOU_ARE_NOT_ALLOWED_TO_PROCEED_FURTHER: {
            code: "UNPROCESSABLE_ENTITY",
            message: "You are not allowed to proceed further.",
            status: 422
        },



        MACHINE_GROUP_ALREADY_EXIST: {
            code: "E_DUPLICATE",
            message: "Machine group with this name already exist.",
            status: 409
        },
        INVALID_SHIFT: {
            code: "E_BAD_REQUEST",
            message: "Shift value is invalid, it should be either 'day' or 'night'.",
            status: 400
        },
        INVALID_INVOICE_DETAILS_CHANGE: {
            code: "UNPROCESSABLE_ENTITY",
            message: "While changing invoice details, you can not change the GST status it will affect the invoice number.",
            status: 422
        },
        PAYMENT_INFO_REQUIRED: {
            code: "UNPROCESSABLE_ENTITY",
            message: "Payment method and payment date are required when marking invoice as paid.",
            status: 422
        }
    }
};