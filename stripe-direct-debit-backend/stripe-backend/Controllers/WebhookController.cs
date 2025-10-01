using Microsoft.AspNetCore.Mvc;
using Stripe;

namespace stripe_backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WebhookController : ControllerBase
    {
        [HttpPost]
        public async Task<IActionResult> HandleWebhook()
        {
            var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
            try
            {
                var stripeEvent = EventUtility.ConstructEvent(
                    json,
                    Request.Headers["Stripe-Signature"],
                    "whsec_replace_with_real_secret"
                );

                switch (stripeEvent.Type)
                {
                    case "setup_intent.succeeded":
                        var setupIntent = stripeEvent.Data.Object as SetupIntent;
                        Console.WriteLine($"✅ SetupIntent {setupIntent?.Id} succeeded");
                        break;

                    case "payment_intent.succeeded":
                        var paymentIntent = stripeEvent.Data.Object as PaymentIntent;
                        Console.WriteLine($"✅ PaymentIntent {paymentIntent?.Id} succeeded, amount={paymentIntent?.AmountReceived}");
                        // TODO: Update your database: mark invoice/order as paid
                        break;

                    case "payment_intent.payment_failed":
                        var failedIntent = stripeEvent.Data.Object as PaymentIntent;
                        Console.WriteLine($"❌ PaymentIntent {failedIntent?.Id} failed: {failedIntent?.LastPaymentError?.Message}");
                        // TODO: Update your database: mark payment failure
                        break;

                    case "payment_intent.processing":
                        var processingIntent = stripeEvent.Data.Object as PaymentIntent;
                        Console.WriteLine($"⏳ PaymentIntent {processingIntent?.Id} is processing");
                        // TODO: Mark payment as pending in DB
                        break;

                    default:
                        Console.WriteLine($"Unhandled event type: {stripeEvent.Type}");
                        break;
                }

                return Ok();
            }
            catch (StripeException e)
            {
                return BadRequest(e.Message);
            }
        }
    }
}