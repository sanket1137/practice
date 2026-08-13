package com.pixelspot.ccms.player.verification

import com.pixelspot.ccms.player.data.model.ApiResponse
import com.google.gson.annotations.SerializedName
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

data class QrChallengeRequest(
    @SerializedName("apiKey") val apiKey: String
)

data class QrChallengeResponse(
    @SerializedName("code") val code: String,
    @SerializedName("expiresAt") val expiresAt: String,
    @SerializedName("qrContent") val qrContent: String
)

data class ScreenVerificationStatusResponse(
    @SerializedName("status") val status: String,
    @SerializedName("canPlay") val canPlay: Boolean
)

interface VerificationApiService {

    @POST("api/v1/screens/{screenId}/verification/qr-challenge")
    suspend fun requestQrChallenge(
        @Path("screenId") screenId: String,
        @Body request: QrChallengeRequest
    ): Response<ApiResponse<QrChallengeResponse>>

    @GET("api/v1/screens/{screenId}/verification/status")
    suspend fun getVerificationStatus(
        @Path("screenId") screenId: String
    ): Response<ApiResponse<ScreenVerificationStatusResponse>>
}
