/* =========================================================
   LUXE DRIVE — Car Rental
   Indian Market Vehicles
   ========================================================= */
(function () {
    'use strict';

    const FRAME_DIR = 'herosection/';
    const FRAME_PREFIX = 'ezgif-frame-';
    const FRAME_COUNT = 266;
    const PRELOAD = 8;
    const DPR_CAP = 2;

    class Car {
        constructor({ id, brand, model, year, category, pricePerDay,
            image, specs, fuel, transmission, seats, power }) {
            Object.assign(this, {
                id, brand, model, year, category, pricePerDay,
                image, specs: specs || [], fuel, transmission, seats, power,
                isAvailable: true
            });
        }

        get fullName() { return `${this.brand} ${this.model}`; }
        get title() { return `${this.year} ${this.brand} ${this.model}`; }
        get badge() { return this.category.toUpperCase(); }
        get priceTag() { return `₹${this.pricePerDay.toLocaleString()}/day`; }

        costFor(days) {
            const d = Math.max(1, Number(days) || 1);
            return d * this.pricePerDay;
        }

        markUnavailable() { this.isAvailable = false; return this; }
        markAvailable() { this.isAvailable = true; return this; }

        toCardHTML() {
            const specs = this.specs.map(s =>
                `<span class="spec">${s}</span>`).join('');
            return `
        <article class="carcard ${this.isAvailable ? '' : 'is-unavailable'}">
          <div class="carcard__media">
            <img src="${this.image}" alt="${this.title}" loading="lazy"
                 onerror="this.onerror=null;this.src='${Car.fallbackImage(this.title)}'" />
            <span class="carcard__tag">${this.badge}</span>
            <span class="carcard__rate">₹${this.pricePerDay.toLocaleString()}/day</span>
          </div>
          <div class="carcard__body">
            <h3 class="carcard__title">${this.brand} ${this.model}
              <small>${this.year} · ${this.fuel} · ${this.transmission} · ${this.seats} seats</small></h3>
            <div class="carcard__specs">${specs}</div>
            <div class="carcard__foot">
              <span class="spec">⚡ ${this.power}</span>
              <button class="btn btn--red carcard__btn" data-book="${this.id}">Reserve</button>
            </div>
          </div>
        </article>`;
        }

        static fallbackImage(title) {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="380">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#1a0505"/><stop offset="1" stop-color="#050505"/>
        </linearGradient></defs>
        <rect width="640" height="380" fill="url(#g)"/>
        <text x="320" y="196" font-family="Montserrat,Arial" font-size="26" font-weight="700"
              fill="#e10600" text-anchor="middle">${title}</text>
        <text x="320" y="228" font-family="Montserrat,Arial" font-size="13" letter-spacing="4"
              fill="#8a8a8a" text-anchor="middle">LUXE DRIVE</text></svg>`;
            return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        }
    }

    class FleetManager {
        constructor(cars = []) {
            this.cars = [];
            cars.forEach(c => this.addCar(c));
        }

        addCar(data) {
            const car = data instanceof Car ? data : new Car(data);
            this.cars.push(car);
            return car;
        }

        get all() { return this.cars.slice(); }
        get size() { return this.cars.length; }
        get available() { return this.cars.filter(c => c.isAvailable); }
        get categories() {
            return ['All', ...new Set(this.cars.map(c => c.category))];
        }
        getById(id) { return this.cars.find(c => c.id === Number(id)) || null; }
        getByCategory(cat) {
            if (!cat || cat === 'All') return this.all;
            return this.cars.filter(c => c.category === cat);
        }
        getAvailableByCategory(cat) {
            return this.getByCategory(cat).filter(c => c.isAvailable);
        }
        reserve(id) {
            const car = this.getById(id);
            if (car && car.isAvailable) { car.markUnavailable(); return car; }
            return null;
        }
        release(id) {
            const car = this.getById(id);
            if (car) car.markAvailable();
            return car;
        }
        get fleetValue() {
            return this.cars.reduce((s, c) => s + c.pricePerDay, 0);
        }
    }

    class Customer {
        constructor(name, email, phone, licence) {
            this.name = (name || '').trim();
            this.email = (email || '').trim();
            this.phone = (phone || '').trim();
            this.licence = (licence || '').trim();
        }

        validate() {
            const eOK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.email);
            const pOK = this.phone.replace(/\D/g, '').length >= 7;
            return {
                name: this.name.length >= 2,
                email: eOK,
                phone: pOK,
                licence: this.licence.length >= 4
            };
        }
        get isValid() { return Object.values(this.validate()).every(Boolean); }
    }

    class Booking {
        constructor({ customer, car, pickup, ret, point, extras = [] }) {
            this.customer = customer;
            this.car = car;
            this.pickup = pickup;
            this.ret = ret;
            this.point = point || 'Downtown Hub';
            this.extras = extras;
            this.createdAt = new Date();
            this.id = 'LX-' + Date.now().toString(36).toUpperCase().slice(-6);
            this.status = 'CONFIRMED';
        }

        get days() {
            const a = new Date(this.pickup), b = new Date(this.ret);
            if (isNaN(a) || isNaN(b)) return 1;
            const d = Math.ceil((b - a) / 86400000);
            return d > 0 ? d : 1;
        }

        get baseCost() { return this.car ? this.car.costFor(this.days) : 0; }
        get extrasCost() {
            const perDay = this.extras.reduce((s, e) => s + (Number(e.price) || 0), 0);
            return perDay * this.days;
        }
        get total() { return this.baseCost + this.extrasCost; }
        get isValid() {
            return !!(this.customer && this.customer.isValid
                && this.car && this.pickup && this.ret);
        }
    }

    class BookingDatabase {
        constructor() {
            this.name = 'LuxeDriveDatabase';
            this.storeName = 'bookings';
            this.ready = this.open();
        }

        open() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.name, 2);
                request.onupgradeneeded = event => {
                    const db = request.result;
                    if (event.oldVersion === 0) {
                        db.createObjectStore(this.storeName, { keyPath: 'id' });
                    }
                    if (event.oldVersion < 2) {
                        const store = request.transaction.objectStore(this.storeName);
                        store.openCursor().onsuccess = cursorEvent => {
                            const cursor = cursorEvent.target.result;
                            if (!cursor) return;
                            const booking = cursor.value;
                            const pickup = new Date(booking.pickup);
                            const ret = new Date(booking.ret);
                            const days = Math.max(1, Math.ceil((ret - pickup) / 86400000));
                            const baseCost = days * Number(booking.car?.pricePerDay || 0);
                            const extrasCost = days * (booking.extras || [])
                                .reduce((sum, extra) => sum + Number(extra.price || 0), 0);
                            cursor.update({ ...booking, days, baseCost, extrasCost,
                                total: baseCost + extrasCost });
                            cursor.continue();
                        };
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async add(booking) {
            const db = await this.ready;
            const record = {
                ...booking,
                customer: { ...booking.customer },
                car: { ...booking.car },
                days: booking.days,
                baseCost: booking.baseCost,
                extrasCost: booking.extrasCost,
                total: booking.total,
                createdAt: booking.createdAt.toISOString()
            };
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, 'readwrite');
                transaction.objectStore(this.storeName).add(record);
                transaction.oncomplete = resolve;
                transaction.onerror = () => reject(transaction.error);
            });
        }
    }

    class ScrollAnimation {
        constructor({ canvas, section, progressBar, frameLabel, content,
            loader, loaderBar, loaderText, onReady }) {
            this.canvas = canvas;
            this.ctx = canvas ? canvas.getContext('2d') : null;
            this.section = section;
            this.progressBar = progressBar;
            this.frameLabel = frameLabel;
            this.content = content;
            this.loader = loader;
            this.loaderBar = loaderBar;
            this.loaderText = loaderText;
            this.onReady = onReady || (() => { });

            this.paths = [];
            this.frames = [];
            this.loadedIndices = [];
            this.loadedCount = 0;
            this.totalFrames = 0;
            this.currentIndex = 0;
            this.smoothProg = 0;
            this.targetProg = 0;
            this.rafId = null;
            this.ready = false;
            this.vw = 0;
            this.vh = 0;

            this.onScroll = this.onScroll.bind(this);
            this.tick = this.tick.bind(this);
            this.handleResize = this.handleResize.bind(this);
        }

        resolveFramePaths() {
            const paths = [];
            for (let i = 1; i <= FRAME_COUNT; i++) {
                paths.push(`${FRAME_DIR}${FRAME_PREFIX}${String(i).padStart(3, '0')}.png`);
            }
            return paths;
        }

        init() {
            this.paths = this.resolveFramePaths();
            this.totalFrames = this.paths.length;
            this.resize();
            window.addEventListener('scroll', this.onScroll, { passive: true });
            window.addEventListener('resize', this.handleResize);
            this.onScroll();
            this.rafId = requestAnimationFrame(this.tick);
            this.startLoading();
        }

        handleResize() {
            this.resize();
            this.onScroll();
        }

        startLoading() {
            const self = this;
            const total = this.totalFrames;
            let settled = 0;

            const onProgress = (n) => {
                self.loadedCount = n;
                if (self.loaderBar) {
                    self.loaderBar.style.width = Math.round((n / total) * 100) + '%';
                }
                if (self.loaderText) {
                    self.loaderText.textContent = `Loading frames · ${n} / ${total}`;
                }
            };

            const onSettled = () => {
                self.ready = true;
                if (self.loader) self.loader.classList.add('is-done');
                document.body.classList.remove('is-locked');
                self.onReady();
            };

            let nextIdx = 0;
            const worker = () => {
                if (nextIdx >= total) return;
                const idx = nextIdx++;
                const img = new Image();
                img.decoding = 'async';
                img.onload = () => {
                    self.frames[idx] = img;
                    self.loadedIndices.push(idx);
                    settled++;
                    onProgress(settled);
                    worker();
                    if (settled >= total) onSettled();
                };
                img.onerror = () => {
                    settled++;
                    onProgress(settled);
                    worker();
                    if (settled >= total) onSettled();
                };
                img.src = self.paths[idx];
            };
            const maxWorkers = Math.min(PRELOAD, total);
            for (let i = 0; i < maxWorkers; i++) worker();
        }

        resize() {
            if (!this.canvas || !this.ctx) return;
            const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
            const w = this.canvas.clientWidth || window.innerWidth;
            const h = this.canvas.clientHeight || window.innerHeight;
            this.canvas.width = Math.round(w * dpr);
            this.canvas.height = Math.round(h * dpr);
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
            this.vw = w;
            this.vh = h;
            this.draw();
        }

        onScroll() {
            if (!this.section) return;
            const rect = this.section.getBoundingClientRect();
            const total = this.section.offsetHeight - window.innerHeight;
            const passed = -rect.top;
            let p = total > 0 ? passed / total : 0;
            p = Math.max(0, Math.min(1, p));
            this.targetProg = p;
        }

        tick() {
            if (this.ready) {
                const k = 0.12;
                this.smoothProg += (this.targetProg - this.smoothProg) * k;
                if (Math.abs(this.targetProg - this.smoothProg) < 0.0001) {
                    this.smoothProg = this.targetProg;
                }
                this.applyProgress(this.smoothProg);
                this.draw();
            }
            this.rafId = requestAnimationFrame(this.tick);
        }

        applyProgress(p) {
            const usable = this.loadedIndices.length;
            if (!usable) return;
            const li = Math.min(usable - 1, Math.max(0, Math.round(p * (usable - 1))));
            const realIdx = this.loadedIndices[li];
            if (realIdx !== undefined && realIdx !== this.currentIndex) {
                this.currentIndex = realIdx;
                if (this.frameLabel) {
                    this.frameLabel.textContent = String(realIdx + 1).padStart(3, '0');
                }
            }
            if (this.progressBar) {
                this.progressBar.style.width = (p * 100).toFixed(2) + '%';
            }
            if (this.content) {
                const fade = p < 0.08 ? 0 : Math.min(1, (p - 0.08) / 0.18);
                this.content.classList.toggle('is-hidden', fade > 0.35);
            }
        }

        draw() {
            if (!this.ctx) return;
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.vw, this.vh);
            const img = this.frames[this.currentIndex];
            if (!img || !img.complete || !img.naturalWidth) return;
            const scale = Math.max(this.vw / img.naturalWidth, this.vh / img.naturalHeight);
            const w = img.naturalWidth * scale;
            const h = img.naturalHeight * scale;
            ctx.drawImage(img, (this.vw - w) / 2, (this.vh - h) / 2, w, h);
        }

        destroy() {
            cancelAnimationFrame(this.rafId);
            window.removeEventListener('scroll', this.onScroll);
            window.removeEventListener('resize', this.handleResize);
        }
    }

    class UI {
        constructor() {
            this.navbar = document.getElementById('navbar');
            this.navLinks = document.getElementById('navLinks');
            this.burger = document.getElementById('burger');
            this.fleetGrid = document.getElementById('fleetGrid');
            this.filters = document.getElementById('filters');
            this.form = document.getElementById('rentalForm');
            this.toast = document.getElementById('toast');
            this.summary = document.getElementById('summary');
            this.summaryList = document.getElementById('summaryList');
            this.fleetEmpty = document.getElementById('fleetEmpty');
            this.activeCategory = 'All';
        }

        initNavbar() {
            const sticky = () => this.navbar.classList.toggle('is-stuck', window.scrollY > 40);
            sticky();
            window.addEventListener('scroll', sticky, { passive: true });
            this.burger.addEventListener('click', () => {
                const open = this.navLinks.classList.toggle('is-open');
                this.burger.classList.toggle('is-open', open);
                this.burger.setAttribute('aria-expanded', String(open));
            });
            this.navLinks.addEventListener('click', e => {
                if (e.target.classList.contains('nav__link')) {
                    this.navLinks.classList.remove('is-open');
                    this.burger.classList.remove('is-open');
                }
            });
            const links = [...this.navLinks.querySelectorAll('.nav__link')];
            const sections = links.map(l => document.querySelector(
                l.getAttribute('href'))).filter(Boolean);
            const spy = new IntersectionObserver(entries => {
                entries.forEach(en => {
                    if (en.isIntersecting) {
                        links.forEach(l =>
                            l.classList.toggle('is-active',
                                l.getAttribute('href') === '#' + en.target.id));
                    }
                });
            }, { rootMargin: '-45% 0px -50% 0px' });
            sections.forEach(s => spy.observe(s));
        }

        renderFilters(categories) {
            this.filters.innerHTML = categories
                .map(c => `<button class="filter ${c === 'All' ? 'is-active' : ''}"
                      data-cat="${c}">${c}</button>`)
                .join('');
        }

        renderFleet(cars) {
            if (!cars.length) {
                this.fleetGrid.innerHTML = '';
                this.fleetEmpty.hidden = false;
                return;
            }
            this.fleetEmpty.hidden = true;
            this.fleetGrid.innerHTML = cars.map(c => c.toCardHTML()).join('');
        }

        renderCarSelect(cars) {
            document.getElementById('f-car').innerHTML = cars.map(c =>
                `<option value="${c.id}" ${c.isAvailable ? '' : 'disabled'}>
          ${c.title} — ₹${c.pricePerDay.toLocaleString()}/day${c.isAvailable ? '' : ' (booked)'}</option>`
            ).join('');
        }

        renderSummary(bookings) {
            if (!bookings.length) { this.summary.hidden = true; return; }
            this.summary.hidden = false;
            this.summaryList.innerHTML = bookings.map(b => `
        <div class="sbook">
          <b>${b.car.title}</b>
          <span>${b.id} · ${b.days} day${b.days > 1 ? 's' : ''} ·
                ${b.pickup} → ${b.ret} · ${b.point}</span>
        </div>`).join('');
        }

        notify(msg, ms = 3200) {
            if (this.toast) {
                this.toast.textContent = msg;
                this.toast.classList.add('is-on');
                clearTimeout(this._t);
                this._t = setTimeout(() => this.toast.classList.remove('is-on'), ms);
            }
        }

        setError(field, msg) {
            const err = document.querySelector(`.err[data-for="${field}"]`);
            const input = document.querySelector(`[name="${field}"]`);
            if (err) err.textContent = msg || '';
            if (input) input.closest('.field').classList.toggle('has-error', !!msg);
        }
        clearErrors() {
            document.querySelectorAll('.err').forEach(e => e.textContent = '');
            document.querySelectorAll('.field').forEach(f =>
                f.classList.remove('has-error'));
        }
    }

    class CarRentalApp {
        constructor() {
            this.ui = new UI();
            this.fleet = new FleetManager();
            this.bookings = [];
            this.bookingDatabase = new BookingDatabase();
            this.hero = null;
        }

        seedFleet() {
            const data = [
                {
                    id: 1, brand: 'Maruti Suzuki', model: 'Swift', year: 2024, category: 'Hatchback', pricePerDay: 1500,
                    image: 'images/maruti-swift.jpg.jpg',
                    specs: ['1.2L Petrol', 'Manual', '5 seats'], fuel: 'Petrol', transmission: 'Manual', seats: 5, power: '82 HP'
                },
                {
                    id: 2, brand: 'Hyundai', model: 'Grand i10 Nios', year: 2024, category: 'Hatchback', pricePerDay: 1400,
                    image: 'images/hyundai-i10.jpg.png',
                    specs: ['1.2L Kappa Petrol', 'Manual', '5 seats'], fuel: 'Petrol', transmission: 'Manual', seats: 5, power: '83 HP'
                },
                {
                    id: 3, brand: 'Tata', model: 'Nexon', year: 2024, category: 'SUV', pricePerDay: 1800,
                    image: 'images/tata-nexon.jpg.jpg',
                    specs: ['1.2L Turbo Petrol', 'Manual', '5 seats'], fuel: 'Petrol', transmission: 'Manual', seats: 5, power: '120 HP'
                },
                {
                    id: 4, brand: 'Mahindra', model: 'XUV700', year: 2024, category: 'SUV', pricePerDay: 2500,
                    image: 'images/mahindra-xuv700.jpg.jpg',
                    specs: ['2.0L mStallion Petrol', 'Automatic', '7 seats'], fuel: 'Petrol', transmission: 'Automatic', seats: 7, power: '200 HP'
                },
                {
                    id: 5, brand: 'Honda', model: 'City', year: 2024, category: 'Sedan', pricePerDay: 2200,
                    image: 'images/honda-city.jpg.jpg',
                    specs: ['1.5L i-VTEC Petrol', 'CVT', '5 seats'], fuel: 'Petrol', transmission: 'Automatic', seats: 5, power: '121 HP'
                },
                {
                    id: 6, brand: 'Toyota', model: 'Innova Crysta', year: 2024, category: 'MPV', pricePerDay: 3500,
                    image: 'images/toyota-innova.jpg.png',
                    specs: ['2.4L Diesel', 'Automatic', '7 seats'], fuel: 'Diesel', transmission: 'Automatic', seats: 7, power: '150 HP'
                },
                {
                    id: 7, brand: 'Kia', model: 'Seltos', year: 2024, category: 'SUV', pricePerDay: 2000,
                    image: 'images/kia-seltos.jpg.jpg',
                    specs: ['1.5L Petrol', 'IVT', '5 seats'], fuel: 'Petrol', transmission: 'Automatic', seats: 5, power: '115 HP'
                },
                {
                    id: 8, brand: 'Volkswagen', model: 'Virtus', year: 2024, category: 'Sedan', pricePerDay: 1900,
                    image: 'images/vw-virtus.jpg.jpeg',
                    specs: ['1.0L TSI Petrol', 'Automatic', '5 seats'], fuel: 'Petrol', transmission: 'Automatic', seats: 5, power: '115 HP'
                },
                {
                    id: 9, brand: 'Ford', model: 'EcoSport', year: 2024, category: 'SUV', pricePerDay: 1700,
                    image: 'images/ford-ecosport.jpg.jpg',
                    specs: ['1.5L Petrol', 'Manual', '5 seats'], fuel: 'Petrol', transmission: 'Manual', seats: 5, power: '110 HP'
                },
                {
                    id: 10, brand: 'Skoda', model: 'Slavia', year: 2024, category: 'Sedan', pricePerDay: 2100,
                    image: 'images/skoda-slavia.jpg.jpg',
                    specs: ['1.0L TSI Petrol', 'Automatic', '5 seats'], fuel: 'Petrol', transmission: 'Automatic', seats: 5, power: '115 HP'
                },
                {
                    id: 11, brand: 'Mercedes-Benz', model: 'C-Class', year: 2024, category: 'Luxury', pricePerDay: 8000,
                    image: 'images/mercedes-cclass.jpg.jpg',
                    specs: ['2.0L Petrol', '9G-Tronic', '5 seats'], fuel: 'Petrol', transmission: 'Automatic', seats: 5, power: '258 HP'
                },
                {
                    id: 12, brand: 'BMW', model: '3 Series', year: 2024, category: 'Luxury', pricePerDay: 8500,
                    image: 'images/bmw-3series.jpg.jpg',
                    specs: ['2.0L Turbo Petrol', 'Steptronic', '5 seats'], fuel: 'Petrol', transmission: 'Automatic', seats: 5, power: '255 HP'
                },
                {
                    id: 13, brand: 'Audi', model: 'Q5', year: 2024, category: 'Luxury SUV', pricePerDay: 9000,
                    image: 'images/audi-q5.jpg.jpg',
                    specs: ['2.0L TFSI', 'quattro', '5 seats'], fuel: 'Petrol', transmission: 'Automatic', seats: 5, power: '249 HP'
                },
                {
                    id: 14, brand: 'Land Rover', model: 'Defender', year: 2024, category: 'Luxury SUV', pricePerDay: 9500,
                    image: 'images/landrover-defender.jpg.jpg',
                    specs: ['3.0L Petrol', 'Automatic', '5 seats'], fuel: 'Petrol', transmission: 'Automatic', seats: 5, power: '300 HP'
                },
                {
                    id: 15, brand: 'Mini', model: 'Cooper', year: 2024, category: 'Hatchback', pricePerDay: 2800,
                    image: 'images/mini-cooper.jpg.jpg',
                    specs: ['2.0L Petrol', 'Automatic', '4 seats'], fuel: 'Petrol', transmission: 'Automatic', seats: 4, power: '189 HP'
                }
            ];
            data.forEach(d => this.fleet.addCar(d));
        }

        init() {
            this.seedFleet();
            this.ui.initNavbar();
            this.renderFleet();
            this.initHero();
            this.initBookingForm();
            this.initReveal();
            this.initCounters();
            document.getElementById('year').textContent = new Date().getFullYear();
        }

        renderFleet() {
            this.ui.renderFilters(this.fleet.categories);
            const cars = this.fleet.getAvailableByCategory(this.ui.activeCategory);
            this.ui.renderFleet(cars);
            this.ui.renderCarSelect(this.fleet.all);
        }

        initHero() {
            const canvas = document.getElementById('heroCanvas');
            const section = document.getElementById('heroScroll');
            this.hero = new ScrollAnimation({
                canvas, section,
                progressBar: document.getElementById('heroProgress'),
                frameLabel: document.getElementById('heroFrameLabel'),
                content: document.getElementById('heroContent'),
                loader: document.getElementById('loader'),
                loaderBar: document.getElementById('loaderBar'),
                loaderText: document.getElementById('loaderText'),
                onReady: () => document.body.classList.remove('is-locked')
            });
            this.hero.init();
        }

        initBookingForm() {
            const form = this.ui.form;
            const sel = document.getElementById('f-car');
            const pickDays = document.getElementById('f-pickup');
            const retDays = document.getElementById('f-return');

            this.setDefaultDates();

            const recalc = () => this.updateTotals();
            sel.addEventListener('change', recalc);
            pickDays.addEventListener('change', () => {
                if (new Date(retDays.value) <= new Date(pickDays.value)) {
                    retDays.value = this.isoDate(new Date(new Date(pickDays.value).getTime() + 86400000));
                }
                retDays.min = this.isoDate(new Date(new Date(pickDays.value).getTime() + 86400000));
                recalc();
            });
            retDays.addEventListener('change', recalc);
            form.querySelectorAll('input[name="extras"]').forEach(cb =>
                cb.addEventListener('change', recalc));
            recalc();

        form.addEventListener('submit', async e => {
            e.preventDefault();
            await this.handleSubmit(form);
        });

            this.ui.fleetGrid.addEventListener('click', e => {
                const btn = e.target.closest('[data-book]');
                if (!btn) return;
                sel.value = btn.dataset.book;
                this.updateTotals();
                document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
                const car = this.fleet.getById(Number(btn.dataset.book));
                if (car) {
                    this.ui.notify(`${car.title} selected — complete details to confirm.`);
                }
            });

            this.ui.filters.addEventListener('click', e => {
                const btn = e.target.closest('[data-cat]');
                if (!btn) return;
                this.ui.activeCategory = btn.dataset.cat;
                this.ui.filters.querySelectorAll('.filter').forEach(f =>
                    f.classList.toggle('is-active', f === btn));
                this.renderFleet();
            });
        }

        isoDate(d) { return d.toISOString().split('T')[0]; }

        setDefaultDates() {
            const d = new Date();
            const pick = document.getElementById('f-pickup');
            const ret = document.getElementById('f-return');
            pick.value = this.isoDate(d);
            ret.value = this.isoDate(new Date(d.getTime() + 3 * 86400000));
            pick.min = this.isoDate(d);
            ret.min = this.isoDate(d);
        }

        updateTotals() {
            const form = this.ui.form;
            const sel = document.getElementById('f-car');
            const car = this.fleet.getById(sel.value);
            const pick = document.getElementById('f-pickup').value;
            const ret = document.getElementById('f-return').value;

            let days = 1;
            if (pick && ret) {
                days = Math.max(1, Math.ceil((new Date(ret) - new Date(pick)) / 86400000));
            }

            const extras = [...form.querySelectorAll('input[name="extras"]:checked')]
                .reduce((s, cb) => s + Number(cb.dataset.price || 0), 0);

            const base = car ? car.costFor(days) : 0;
            const extrasTotal = extras * days;

            document.getElementById('totalDays').textContent =
                `${days} day${days > 1 ? 's' : ''}`;
            document.getElementById('totalBase').textContent = '₹' + base.toLocaleString();
            document.getElementById('totalExtras').textContent = '₹' + extrasTotal.toLocaleString();
            document.getElementById('totalGrand').textContent = '₹' + (base + extrasTotal).toLocaleString();
        }

        async handleSubmit(form) {
            this.ui.clearErrors();
            const fd = new FormData(form);
            const customer = new Customer(fd.get('name'), fd.get('email'),
                fd.get('phone'), fd.get('licence'));

            const v = customer.validate();
            const map = { name: 'name', email: 'email', phone: 'phone', licence: 'licence' };
            let firstBad = null;
            for (const k in v) {
                if (!v[k]) {
                    this.ui.setError(map[k], 'Required / invalid.');
                    if (!firstBad) firstBad = map[k];
                }
            }

            const car = this.fleet.getById(fd.get('carId'));
            if (!car) { this.ui.setError('carId', 'Select a vehicle.'); firstBad = firstBad || 'carId'; }
            else if (!car.isAvailable) { this.ui.setError('carId', 'Already booked.'); firstBad = firstBad || 'carId'; }

            const pick = fd.get('pickup'), ret = fd.get('return');
            if (!pick) { this.ui.setError('pickup', 'Pick date.'); firstBad = firstBad || 'pickup'; }
            if (!ret) { this.ui.setError('return', 'Pick date.'); firstBad = firstBad || 'return'; }
            if (pick && ret && new Date(ret) <= new Date(pick)) {
                this.ui.setError('return', 'Return after pickup.');
                firstBad = firstBad || 'return';
            }
            if (firstBad) {
                this.ui.notify('Please correct the highlighted fields.');
                const el = document.querySelector(`[name="${firstBad}"]`);
                if (el) el.focus();
                return;
            }

            const booking = new Booking({
                customer, car, pickup: pick, ret,
                point: fd.get('point'),
                extras: [...form.querySelectorAll('input[name="extras"]:checked')]
                    .map(cb => ({ name: cb.value, price: Number(cb.dataset.price || 0) }))
            });

            try {
                await this.bookingDatabase.add(booking);
            } catch (error) {
                console.error('Could not save booking:', error);
                this.ui.notify('Unable to save booking. Please try again.');
                return;
            }

            this.fleet.reserve(car.id);
            this.bookings.push(booking);
            this.ui.renderSummary(this.bookings);
            this.renderFleet();
            form.reset();
            this.setDefaultDates();
            this.updateTotals();

            this.ui.notify('THANKS FOR BOOKING. ENJOY YOUR DRIVE');
        }

        initReveal() {
            const obs = new IntersectionObserver(entries => {
                entries.forEach(e => {
                    if (e.isIntersecting) {
                        e.target.classList.add('is-visible');
                        obs.unobserve(e.target);
                    }
                });
            }, { threshold: 0.12 });
            document.querySelectorAll('.reveal').forEach((el, i) => {
                el.style.transitionDelay = (i % 4) * 70 + 'ms';
                obs.observe(el);
            });
        }

        initCounters() {
            const obs = new IntersectionObserver(entries => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    const el = e.target, target = Number(el.dataset.count);
                    let cur = 0;
                    const step = () => {
                        cur += Math.max(1, Math.round(target / 28));
                        if (cur >= target) { el.textContent = target; return; }
                        el.textContent = cur;
                        requestAnimationFrame(step);
                    };
                    step();
                    obs.unobserve(el);
                });
            }, { threshold: 0.5 });
            document.querySelectorAll('[data-count]').forEach(el => obs.observe(el));
        }
    }

    function boot() {
        const app = new CarRentalApp();
        app.init();
        window.LUXE_DRIVE = app;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
