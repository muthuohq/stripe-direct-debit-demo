using Microsoft.AspNetCore.Mvc;
using Stripe;

namespace stripe_backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SetupIntentController : ControllerBase
    {
        [HttpPost("create-setup-intent")]
        public IActionResult CreateSetupIntent()
        {
            var options = new SetupIntentCreateOptions
            {
                PaymentMethodTypes = new List<string> { "bacs_debit" },
                Confirm = false,
                Usage = "off_session"
            };
            var service = new SetupIntentService();
            var intent = service.Create(options);

            return Ok(new { clientSecret = intent.ClientSecret });
        }

        [HttpPost("create-payment-intent")]
        public IActionResult CreatePaymentIntent()
        {
            var options = new PaymentIntentCreateOptions
            {
                Amount = 100, // minimal charge in GBP pence (£1.00 = 100)
                Currency = "gbp",
                PaymentMethodTypes = new List<string> { "bacs_debit" },
                SetupFutureUsage = "off_session"
            };
            var service = new PaymentIntentService();
            var intent = service.Create(options);

            return Ok(new { clientSecret = intent.ClientSecret });
        }
    }
}