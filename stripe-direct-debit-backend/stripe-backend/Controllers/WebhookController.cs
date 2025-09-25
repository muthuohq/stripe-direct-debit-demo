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

                if (stripeEvent.Type == "setup_intent.succeeded")
                {
                    var setupIntent = stripeEvent.Data.Object as SetupIntent;
                    Console.WriteLine($"SetupIntent {setupIntent?.Id} succeeded");
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